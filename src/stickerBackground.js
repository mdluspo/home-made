// Local, edge-connected colour segmentation. Never upload the user's photo.
// Multiple border colours handle gradients without averaging unrelated corners.
const linear=Float32Array.from({length:256},(_,i)=>{const s=i/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
const curve=n=>n>.008856?Math.cbrt(n):7.787*n+16/116;
const delta=(lab,a,b)=>Math.hypot(lab[a]-lab[b],lab[a+1]-lab[b+1],lab[a+2]-lab[b+2]);
export function removeStickerBackground({data,width,height},{strength=45}={}){
  const size=width*height,out=new Uint8ClampedArray(data);
  if(!size)return out;
  const border=[];
  for(let x=0;x<width;x++){border.push(x);if(height>1)border.push((height-1)*width+x);}
  for(let y=1;y<height-1;y++){border.push(y*width);if(width>1)border.push(y*width+width-1);}
  // Already-transparent PNGs should not have their subject cut a second time.
  if(border.filter(n=>data[n*4+3]<16).length>border.length*.6)return out;
  const lab=new Float32Array(size*3);
  for(let n=0;n<size;n++){
    const i=n*4,j=n*3,r=linear[data[i]],g=linear[data[i+1]],b=linear[data[i+2]];
    const x=curve((r*.4124564+g*.3575761+b*.1804375)/.95047),y=curve(r*.2126729+g*.7151522+b*.072175),z=curve((r*.0193339+g*.119192+b*.9503041)/1.08883);
    lab[j]=116*y-16;lab[j+1]=500*(x-y);lab[j+2]=200*(y-z);
  }
  const clusters=[];
  for(const n of border){
    if(data[n*4+3]<16)continue;
    const j=n*3;
    let best=null,distance=Infinity;
    for(const c of clusters){const d=Math.hypot(lab[j]-c.l,lab[j+1]-c.a,lab[j+2]-c.b);if(d<distance){distance=d;best=c;}}
    if(distance>12){if(clusters.length<48)clusters.push({l:lab[j],a:lab[j+1],b:lab[j+2],count:1,r:data[n*4],g:data[n*4+1],blue:data[n*4+2]});continue;}
    const count=++best.count;
    for(const [key,value] of [['l',lab[j]],['a',lab[j+1]],['b',lab[j+2]],['r',data[n*4]],['g',data[n*4+1]],['blue',data[n*4+2]]])best[key]+=(value-best[key])/count;
  }
  const models=clusters.filter(c=>c.count>=Math.max(2,border.length*.03)).sort((a,b)=>b.count-a.count).slice(0,8);
  if(!models.length)return out;
  const threshold=8+Math.max(0,Math.min(100,strength))*.26,edgeStop=12+threshold*.45;
  const distances=new Float32Array(size),modelAt=new Uint8Array(size);
  for(let n=0;n<size;n++){
    const j=n*3;let best=Infinity;
    models.forEach((c,k)=>{const d=Math.hypot(lab[j]-c.l,lab[j+1]-c.a,lab[j+2]-c.b);if(d<best){best=d;modelAt[n]=k;}});
    distances[n]=best;
  }
  const removed=new Uint8Array(size),queue=new Int32Array(size);let tail=0;
  const push=(n,from=-1)=>{
    if(removed[n])return;
    const transparent=data[n*4+3]<16;
    if(!transparent&&(distances[n]>threshold||from<0&&distances[n]>threshold*.72||from>=0&&data[from*4+3]>=16&&delta(lab,n*3,from*3)>edgeStop))return;
    removed[n]=1;queue[tail++]=n;
  };
  for(const n of border)push(n);
  for(let head=0;head<tail;head++){
    const n=queue[head],x=n%width;
    if(x)push(n-1,n);if(x<width-1)push(n+1,n);
    if(n>=width)push(n-width,n);if(n<size-width)push(n+width,n);
  }
  for(let n=0;n<size;n++){
    const i=n*4;
    if(removed[n]){out[i+3]=0;continue;}
    if(distances[n]>threshold*1.4||data[i+3]===0)continue;
    const x=n%width,y=Math.floor(n/width);let neighbors=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&removed[(y+dy)*width+x+dx])neighbors++;
    if(neighbors<2)continue;
    const alpha=Math.max(.12,Math.min(1,(distances[n]-threshold*.8)/(threshold*.6)));
    out[i+3]=Math.round(data[i+3]*alpha);
    // Remove background-colour spill from softened boundary pixels.
    const bg=models[modelAt[n]];
    for(const [channel,key] of [[0,'r'],[1,'g'],[2,'blue']])out[i+channel]=Math.max(0,Math.min(255,(data[i+channel]-bg[key]*(1-alpha))/alpha));
  }
  return out;
}

export async function makeStickerCutout(src,strength=45){
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const image=ctx.getImageData(0,0,canvas.width,canvas.height);
  image.data.set(removeStickerBackground(image,{strength}));ctx.putImageData(image,0,0);
  return canvas.toDataURL('image/png');
}
