import React, {useContext, useId, useState} from 'react';
import './mtm-source-content.css';
import ZoomableImage from './ZoomableImage';
import {RoomQuestionContext} from './RoomQuestionContext';

export type SourceSegment = {path: string; width: number; height: number; sha256: string; sourcePage: number; mtmAuthored?: true;privateUrl?:string;privateUnavailable?:boolean};

/** The raster preserves source glyphs and figures; branding is a separate, reversible layer. */
export default function MtmSourceContent({segments, assetBase, label, kind}: {
  segments: SourceSegment[]; assetBase: string; label: string; kind: 'question' | 'solution';
}) {
  const instance = useId();
  const inRoom = useContext(RoomQuestionContext) !== null;
  const [retry,setRetry]=useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  return <section className="mtm-source-content" aria-label={`${kind === 'question' ? 'Đề' : 'Lời giải'} ${label}`}>
    <div className="mtm-source-sheet">
        {segments.map((segment, index) => <figure className="mtm-source-segment" key={segment.path}>
          {segment.privateUnavailable||failed.has(segment.privateUrl??segment.path) ? <p className="mtm-source-error" role="alert"><span>Không tải được phần {index + 1} của {label}. Em có thể làm câu khác hoặc nộp phần đã làm.</span><button type="button" onClick={()=>{setFailed(previous=>{const next=new Set(previous);next.delete(segment.privateUrl??segment.path);return next;});setRetry(value=>value+1);window.dispatchEvent(new Event('mtm:retry-assets'));}}>Thử tải lại ảnh</button></p> : <>
            {/* TH-02 (Đợt 4): bấm ảnh hoặc nút "Phóng to" để xem toàn màn; ảnh trong bài giữ nguyên. */}
            <ZoomableImage key={`${segment.privateUrl??segment.path}:${retry}`} src={segment.privateUrl??`${assetBase}/${segment.path}`} width={segment.width} height={segment.height} loading={inRoom?'eager':'lazy'}
              watermark label={`${kind === 'question' ? 'Đề' : 'Lời giải'} ${label}${segments.length > 1 ? `, phần ${index + 1}/${segments.length}` : ''}`}
              alt={`${label}${kind === 'solution' ? ' · lời giải' : ''}, phần ${index + 1}/${segments.length}. Chữ, công thức và hình được giữ từ bản gốc.`}
              onError={() => setFailed(previous => new Set([...previous, segment.privateUrl??segment.path]))}/>
            <svg className="mtm-source-watermark" aria-hidden="true" width="100%" height="100%">
              <defs><pattern id={`${instance}-${index}`} width="390" height="115" patternUnits="userSpaceOnUse"><text x="24" y="40" transform="rotate(-8 24 40)">MINH THÀNH MATH</text></pattern></defs>
              <rect width="100%" height="100%" fill={`url(#${instance}-${index})`}/>
            </svg>
          </>}
        </figure>)}
    </div>
  </section>;
}
