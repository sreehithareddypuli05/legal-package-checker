import {demoProducts} from '../data/productCatalog';
import type {DeclarationData} from '../types';
export async function analyzePackage(fileName:string, preferredId?:string):Promise<DeclarationData>{
  await new Promise(r=>setTimeout(r,900));
  const product=demoProducts.find(p=>p.id===preferredId)||demoProducts.find(p=>fileName.toLowerCase().includes(p.id.replace(/-/g,'')))||demoProducts.find(p=>fileName.toLowerCase().includes(p.name.toLowerCase().replace(/ /g,'')));
  return product ? {...product.data,mode:'DEMO_PROTOTYPE'} : {...demoProducts[0].data,mode:'DEMO_PROTOTYPE'};
}
