import React from 'react';
import {floorOutlines} from './model.js';

// Paint last so an outline whose plan coordinates extend above zero cannot
// cover its own title. Position relative to the ENTIRE merged floor footprint.
export function LevelLabels({home,raised=false}){
  return <g className="level-titles" pointerEvents="none">
    {floorOutlines(home).map((ring,i)=>{
      const left=Math.min(...ring.map(p=>p.x)),right=Math.max(...ring.map(p=>p.x));
      const top=Math.min(...ring.map(p=>p.y));
      return <text key={i} className="level-label" x={(left+right)/2} y={top-(raised?106:72)} textAnchor="middle" dominantBaseline="middle" fill="#526b41" fontSize="18" fontWeight="700" paintOrder="stroke" stroke="#fbfaf2" strokeWidth="5" strokeLinejoin="round">Level {home.floorLevels?.[i]??(home.level||1)+i}</text>;
    })}
  </g>;
}
