export type DeclarationData = {
  productName:string; manufacturer:string; commonName:string; netQuantity:string; mrp:string;
  packedDate:string; bestBefore:string; batchNumber:string; consumerCare:string;
  countryOfOrigin:string; unitSalePrice:string; readability:string; mode?:string;
};
export type Check = {field:string; value:string; status:'PASS'|'FAIL'|'REVIEW'; reason:string; rule?:string};
