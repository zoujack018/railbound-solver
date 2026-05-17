import { SOLVER_WORKER_CODE } from "../railbound-worker-code.js";
const W = 7, H = 5;
const puzzle = {
  width: W, height: H,
  fixed: { "3,0": "-", "3,4": "-", "5,1": "|", "5,2": "T_ES_N", "5,3": "|" },
  blanks: [[1,0], [2,0], [1,1], [2,1], [1,3], [2,3], [1,4], [2,4]],
  cars: [{ name: "1", x: 3, y: 0, entry: "E" }, { name: "2", x: 3, y: 4, entry: "E" }],
  goal: [6, 2], goalEntry: "W", order: ["1", "2"], maxSteps: 50,
  tunnels: [
    { color: "#e74c3c", cells: [{ x: 0, y: 0, facing: "E" }, { x: 5, y: 4, facing: "N" }] },
    { color: "#3498db", cells: [{ x: 0, y: 4, facing: "E" }, { x: 5, y: 0, facing: "S" }] }
  ]
};
global.self = {
  postMessage: (msg) => {
    if (msg.type === "solution") console.log("SOLUTION FOUND!", msg.solution);
    if (msg.type === "done") console.log("DONE!", msg);
  },
  onmessage: null
};

const fixedCode = SOLVER_WORKER_CODE.replace(
`      if(placed[k]){
        const old=placed[k];
        const ex0=exitPort(old,c.entry);
        if(ex0!==null){
          if(!hasUsage(k,c.entry,ex0)){
            const undo=pushUsage(k,c.entry,ex0);
            dfs(cars,arrived,step,visited);undo();return;}
          continue;}
        const ups=findUpgrades(old,c.x,c.y,c.entry);
        for(const up of ups){
          placed[k]=up.track;
          const undo=pushUsage(k,c.entry,up.exit);
          dfs(cars,arrived,step,visited);undo();
          placed[k]=old;
          if(!minTracks&&solutions.length>=maxSol)return;}
        return;}`,
`      if(placed[k]){
        const old=placed[k];
        const ex0=exitPort(old,c.entry);
        const ups=findUpgrades(old,c.x,c.y,c.entry);
        for(const up of ups){
          if(up.exit===ex0)continue;
          placed[k]=up.track;
          const undo=pushUsage(k,c.entry,up.exit);
          dfs(cars,arrived,step,visited);undo();
          placed[k]=old;
          if(!minTracks&&solutions.length>=maxSol)return;}
        if(ex0!==null){
          if(!hasUsage(k,c.entry,ex0)){
            const undo=pushUsage(k,c.entry,ex0);
            dfs(cars,arrived,step,visited);undo();return;}
          continue;}
        return;}`
);

eval(fixedCode);
self.onmessage({ data: { type: "solve", puzzle: puzzle, seed: 0, maxTracksHint: 0 } });
