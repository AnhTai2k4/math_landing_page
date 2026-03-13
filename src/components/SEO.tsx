import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = "Minh Thành Math - Trung Tâm Toán Cấp 3 Uy Tín | Hà Nội",
  description = "Trung tâm dạy Toán cấp 3 chất lượng cao tại Hà Nội. Đội ngũ giảng viên giàu kinh nghiệm, phương pháp giảng dạy hiện đại, 95% học sinh đạt điểm cao. Đăng ký học thử miễn phí.",
  keywords = "dạy toán cấp 3, trung tâm toán THPT, luyện thi THPT Quốc gia, học toán lớp 10, học toán lớp 11, học toán lớp 12, gia sư toán, Minh Thành Math, toán Hà Nội",
  ogImage = "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&h=630&fit=crop",
  url = "https://minhthanhmath.com",
  type = "website"
}: SEOProps) {
  const siteTitle = title.includes("Minh Thành Math") ? title : `${title} | Minh Thành Math`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{siteTitle}</title>
      <meta name="title" content={siteTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Minh Thành Math" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="Vietnamese" />
      <meta name="revisit-after" content="7 days" />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Minh Thành Math" />
      <meta property="og:locale" content="vi_VN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO */}
      <meta name="geo.region" content="VN-SG" />
      <meta name="geo.placename" content="Ho Chi Minh City" />
      <meta name="geo.position" content="10.8231;106.6297" />
      <meta name="ICBM" content="10.8231, 106.6297" />

      {/* Mobile Optimization */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#2563eb" />
    </Helmet>
  );
}
