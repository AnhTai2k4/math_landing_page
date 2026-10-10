import {Formula} from '../exams/DetailedSolution';
export default function NotationGuide(){return <details><summary>Ký hiệu Toán theo Kết nối tri thức lớp 10–12</summary><p>Điểm/phần tử dùng thuộc hoặc không thuộc; đường thẳng nằm trong mặt phẳng dùng dấu tập con. Dấu tập con trong quy ước SGK này cho phép bằng nhau.</p>{[
 ['Thuộc / không thuộc',String.raw`a\in A,\quad b\notin A`],
 ['Tập con / không là tập con',String.raw`B\subset A,\quad C\not\subset A`],
 ['Chỉnh hợp / tổ hợp',String.raw`A_n^k=\frac{n!}{(n-k)!},\quad C_n^k=\frac{n!}{k!(n-k)!}`],
 ['Điểm thuộc; đường nằm trong mặt phẳng',String.raw`M\in(P),\quad d\subset(P)`],
 ['Song song / vuông góc',String.raw`a\parallel b,\quad d\perp(P)`],
 ['Tọa độ',String.raw`M(x;y;z),\quad\vec u=(a;b;c)`]
 ].map(([label,latex])=><div key={label}><p>{label}</p><Formula latex={latex}/><code>{latex}</code></div>)}<a href="https://taphuan.nxbgd.vn/tap-huan?grade=10" target="_blank" rel="noopener noreferrer">Sách và học liệu NXB</a><p>Nhập công thức giữa hai dấu $ trong lời giải. PDF nguồn được giữ nguyên.</p></details>;}
