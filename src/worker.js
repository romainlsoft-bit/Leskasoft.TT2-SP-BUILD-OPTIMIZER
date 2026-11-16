import { optimizeBuild } from "./engine.js";
self.onmessage = event => {
  if(event.data?.type!=="optimize") return;
  try {
    const result=optimizeBuild(event.data.settings, progress=>self.postMessage({progress}));
    self.postMessage({ok:true,result});
  } catch (error) {
    self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)});
  }
};
