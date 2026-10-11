import {Component,lazy,Suspense,useEffect,type ReactNode} from 'react';
import {routeMetadata} from './migration/route-policy';
import {SEOProvider} from './components/SEOProvider';import {SEO} from './components/SEO';import {StructuredData} from './components/StructuredData';


import {Footer} from './components/Footer';import {FloatingContact} from './components/FloatingContact';import {Toaster} from './components/ui/sonner';

import {MigrationHeader,PreviewNotice,AccessDialog} from './migration/Experience';
const Home=lazy(()=>import('./migration/Home'));
const Catalogue=lazy(()=>import('./native/NativeCourses').then(m=>({default:m.NativeCatalogue})));
const CourseDetail=lazy(()=>import('./native/NativeCourses').then(m=>({default:m.NativeCourseDetail})));
const NativeLesson=lazy(()=>import('./native/NativeCourses').then(m=>({default:m.NativeLesson})));
const NativeResources=lazy(()=>import('./native/NativeResources'));
const NativeExams=lazy(()=>import('./native/admin/PublishedExams'));
const PracticeLibrary=lazy(()=>import('./native/chapters/PracticeLibrary'));
const AdminExams=lazy(()=>import('./native/admin/AdminExams'));
const StudentHomework=lazy(()=>import('./native/homework/StudentHomework'));
const AdminHomework=lazy(()=>import('./native/homework/AdminHomework'));
import {publicSnapshot} from './native/model';
const Notebook=lazy(()=>import('./migration/Notebook'));
const NotFound=lazy(()=>import('./migration/StudyRoutes').then(m=>({default:m.NotFound})));
class RouteError extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?<section className="mig-container mig-panel mig-load-error" role="alert"><h1>Chưa tải được nội dung</h1><p>Kết nối có thể đã gián đoạn hoặc phiên bản trang vừa thay đổi. Bản sổ tay đã lưu trên trình duyệt không bị xóa.</p><button type="button" className="mig-button outline" onClick={()=>location.reload()}>Thử tải lại trang</button></section>:this.props.children;}}

import {Link,useRoute,RoutePosition,navigate} from './migration/navigation';import {findCourse} from './migration/catalogue';
export default function App(){const route=useRoute();const path=route.pathname;const slug=path.startsWith('/khoa-hoc/')?path.slice('/khoa-hoc/'.length):'';const course=slug?findCourse(slug):undefined;const name=path==='/'?'Học cùng MTM':path==='/khoa-hoc'?'Khóa học Toán':course?.title||({ '/thi-thu':'Thi thử và bài tập','/so-tay':'Sổ tay học tập','/tai-lieu':'Thư viện học liệu'} as Record<string,string>)[path]||'Không tìm thấy trang';
useEffect(()=>{const click=(event:MouseEvent)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const target=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href^="#"]'):null;const hash=target?.getAttribute('href');if(hash&&hash.length>1){event.preventDefault();if(hash==='#main-content'){navigate(location.pathname+location.search+hash);}else if(hash==='#tai-lieu-tham-khao'){navigate('/tai-lieu'+hash);}else{navigate('/'+hash);}}};document.addEventListener('click',click);return()=>document.removeEventListener('click',click);},[]);
const metadata=routeMetadata(path,location.hostname,route.search);
return <SEOProvider><SEO {...metadata}/><StructuredData/><div className={'mtm-migration'+(path!=='/'?' is-learning':'')}><a className="mtm-skip" href="#main-content">Đến nội dung chính</a><MigrationHeader pathname={path}/><PreviewNotice/><main id="main-content" tabIndex={-1}><RouteError key={path}><Suspense fallback={<div className="mig-container mig-route-loading" role="status" aria-live="polite">Đang tải nội dung…</div>}>{path==='/'?<Home/>:path==='/khoa-hoc'?<Catalogue search={route.search}/>:course?<CourseDetail key={course.slug} course={course}/>:path.startsWith('/bai-hoc/')?<NativeLesson key={path+route.search} pathname={path} search={route.search}/>:path==='/thi-thu'||path.startsWith('/thi-thu/')?(publicSnapshot.exams.some(x=>path==='/thi-thu/'+x.id)?<NativeResources kind="exams" pathname={path} search={route.search}/>:<NativeExams pathname={path} search={route.search}/>):path==='/luyen-tap'?<PracticeLibrary/>:path==='/btvn'?<StudentHomework/>:path==='/quan-tri/btvn'?<AdminHomework/>:path==='/quan-tri/de-thi'?<AdminExams/>:path==='/so-tay'?<Notebook/>:path==='/tai-lieu'||path.startsWith('/tai-lieu/')?<NativeResources kind="documents" pathname={path} search={route.search}/>:<NotFound/>}</Suspense></RouteError></main><Footer/><FloatingContact/><AccessDialog/><RoutePosition pathname={path} hash={route.hash}/><Toaster position="top-center"/></div></SEOProvider>;
}
