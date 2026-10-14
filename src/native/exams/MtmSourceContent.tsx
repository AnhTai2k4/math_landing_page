import React, {useId, useState} from 'react';
import './mtm-source-content.css';
import ZoomableImage from './ZoomableImage';

export type SourceSegment = {path: string; width: number; height: number; sha256: string; sourcePage: number; mtmAuthored?: true;privateUrl?:string};

/** The raster preserves source glyphs and figures; branding is a separate, reversible layer. */
export default function MtmSourceContent({segments, assetBase, label, kind}: {
  segments: SourceSegment[]; assetBase: string; label: string; kind: 'question' | 'solution';
}) {
  const instance = useId();
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  return <section className="mtm-source-content" aria-label={`${kind === 'question' ? 'Đề' : 'Lời giải'} ${label}`}>
    <div className="mtm-source-sheet">
        {segments.map((segment, index) => <figure className="mtm-source-segment" key={segment.path}>
          {failed.has(segment.path) ? <p role="alert">Không tải được phần {index + 1} của {label}. Hãy tải lại trang; chưa thể xác nhận nội dung đã đầy đủ.</p> : <>
            {/* TH-02 (Đợt 4): bấm ảnh hoặc nút "Phóng to" để xem toàn màn; ảnh trong bài giữ nguyên. */}
            <ZoomableImage src={segment.privateUrl??`${assetBase}/${segment.path}`} width={segment.width} height={segment.height}
              watermark label={`${kind === 'question' ? 'Đề' : 'Lời giải'} ${label}${segments.length > 1 ? `, phần ${index + 1}/${segments.length}` : ''}`}
              alt={`${label}${kind === 'solution' ? ' · lời giải' : ''}, phần ${index + 1}/${segments.length}. Chữ, công thức và hình được giữ từ bản gốc.`}
              onError={() => setFailed(previous => new Set([...previous, segment.path]))}/>
            <svg className="mtm-source-watermark" aria-hidden="true" width="100%" height="100%">
              <defs><pattern id={`${instance}-${index}`} width="390" height="115" patternUnits="userSpaceOnUse"><text x="24" y="40" transform="rotate(-8 24 40)">MINH THÀNH MATH</text></pattern></defs>
              <rect width="100%" height="100%" fill={`url(#${instance}-${index})`}/>
            </svg>
          </>}
        </figure>)}
    </div>
  </section>;
}
