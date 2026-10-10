/** Kết nối tri thức 10–12 presentation, reviewed against the NXB book pages.
 * Source PDFs, answer keys, version identities and mathematical values remain intact. */
export function schoolLatex(latex:string):string {
 const coordinates:Record<string,string>={
  'A=(0,0,0),\\ B=(1,0,0),\\ D=(0,1,0),\\ C=(1,1,0),\\ S=(0,0,1)':'A=(0;0;0),\\ B=(1;0;0),\\ D=(0;1;0),\\ C=(1;1;0),\\ S=(0;0;1)',
  'M=(0,1/3,0),\\quad N=(2/3,1/3,0),\\quad G=(1/3,0,1/3)':'M=\\left(0;\\frac13;0\\right),\\quad N=\\left(\\frac23;\\frac13;0\\right),\\quad G=\\left(\\frac13;0;\\frac13\\right)',
  '\\overrightarrow{DN}=(2/3,-2/3,0)=\\frac23\\overrightarrow{DB}\\Rightarrow \\frac{DN}{DB}=\\frac23':'\\overrightarrow{DN}=\\left(\\frac23;-\\frac23;0\\right)=\\frac23\\overrightarrow{DB}\\Rightarrow \\frac{DN}{DB}=\\frac23',
  '\\overrightarrow{MN}=(2/3,0,0)\\parallel\\overrightarrow{CD}=(-1,0,0)':'\\overrightarrow{MN}=\\left(\\frac23;0;0\\right),\\quad\\overrightarrow{CD}=(-1;0;0),\\quad\\overrightarrow{MN}=-\\frac23\\overrightarrow{CD}'
 };
 return (coordinates[latex]??latex).replace(/\\parallel(?![A-Za-z])/g,'\\mathrel{/\\mkern-3mu/}').replaceAll('\\binom43','C_4^3');
}
export function schoolText(text:string){return text.replaceAll('B ⊆ A','$B\\subset A$').replaceAll('{2;4} ⊆ X','$\\{2;4\\}\\subset X$');}
