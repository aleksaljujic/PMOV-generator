import { it } from 'vitest';
import { makeFixtureGraph } from './__fixtures__/graph';
import { layoutDiagramSync } from './index';
import { buildCore } from './model';
it('d', () => {
  const g = makeFixtureGraph();
  console.log(JSON.stringify(buildCore(g).groups));
  const p = layoutDiagramSync(g);
  for (const id of ['Radnik','Tehnicar','Inzenjer','Admin','junction:Z','spec:Z','Sef']) console.log(id, p[id]);
});
