export type FormulaPair={id:string;expression:string;answer:string;condition:string;explanation:string};
export type FormulaDeck={id:string;title:string;pairs:readonly FormulaPair[]};

// Học liệu tĩnh MTM biên soạn, không dùng điểm thi hoặc dữ liệu học sinh.
export const FORMULA_DECKS:readonly FormulaDeck[]=[
 {id:'identities',title:'Hằng đẳng thức',pairs:[
  {id:'sum-square',expression:'(a + b)²',answer:'a² + 2ab + b²',condition:'Với mọi số thực a, b.',explanation:'Nhân (a + b)(a + b), rồi cộng hai tích ab để được 2ab.'},
  {id:'difference-square',expression:'(a − b)²',answer:'a² − 2ab + b²',condition:'Với mọi số thực a, b.',explanation:'Nhân (a − b)(a − b). Hai tích giữa là −ab và −ab nên tổng là −2ab.'},
  {id:'difference-of-squares',expression:'a² − b²',answer:'(a − b)(a + b)',condition:'Với mọi số thực a, b.',explanation:'Khai triển (a − b)(a + b), hai tích ab và −ab triệt tiêu nhau.'},
 ]},
 {id:'conditions',title:'Căn thức và điều kiện',pairs:[
  {id:'root-square',expression:'√(a²)',answer:'|a|',condition:'Với mọi số thực a.',explanation:'Căn bậc hai số học luôn không âm. Ví dụ a = −3 thì √(a²) = √9 = 3 = |−3|.'},
  {id:'root-product',expression:'√(ab)',answer:'√a · √b',condition:'a ≥ 0 và b ≥ 0.',explanation:'Với a, b không âm, cả hai căn đều xác định và tích của chúng không âm, có bình phương bằng ab. Không áp dụng khi a = b = −1.'},
  {id:'power-quotient',expression:'a³ / a²',answer:'a',condition:'a ≠ 0.',explanation:'Mẫu a² phải khác 0. Khi đó a³ / a² = a · a² / a² = a; không được rút gọn tại a = 0.'},
 ]},
];
