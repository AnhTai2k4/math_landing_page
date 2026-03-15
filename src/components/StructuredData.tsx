import { Helmet } from "react-helmet-async";

export function StructuredData() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Minh Thành Math",
    "alternateName": "Trung Tâm Toán Minh Thành",
    "url": "https://minhthanhmath.com",
    "logo": "https://minhthanhmath.com/logo.png",
    "description": "Trung tâm dạy Toán cấp 3 chất lượng cao, giúp học sinh nắm vững kiến thức và đạt điểm cao trong các kỳ thi",
    "foundingDate": "2015",
    "email": "contact@minhthanhmath.com",
    "telephone": "+84-123-456-789",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "82 Chùa Láng, Láng Thượng",
      "addressLocality": "Đống Đa",
      "addressRegion": "Hà Nội",
      "postalCode": "100000",
      "addressCountry": "VN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "21.0285",
      "longitude": "105.8542"
    },
    "sameAs": [
      "https://facebook.com/minhthanhmath",
      "https://youtube.com/minhthanhmath",
      "https://instagram.com/minhthanhmath"
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "500",
      "bestRating": "5",
      "worstRating": "1"
    }
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://minhthanhmath.com/#business",
    "name": "Minh Thành Math",
    "image": "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200&h=630&fit=crop",
    "priceRange": "$$",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "82 Chùa Láng, Láng Thượng",
      "addressLocality": "Đống Đa",
      "addressRegion": "Hà Nội",
      "postalCode": "100000",
      "addressCountry": "VN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "21.0285",
      "longitude": "105.8542"
    },
    "url": "https://minhthanhmath.com",
    "telephone": "+84-123-456-789",
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "08:00",
        "closes": "20:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Sunday",
        "opens": "08:00",
        "closes": "17:00"
      }
    ]
  };

  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "Course",
        "name": "Toán Lớp 10",
        "description": "Khóa học Toán lớp 10 với nền tảng vững chắc, bao gồm Đại số, Hình học và Lượng giác",
        "provider": {
          "@type": "Organization",
          "name": "Minh Thành Math"
        },
        "educationalLevel": "Grade 10",
        "courseCode": "TOAN10",
        "hasCourseInstance": {
          "@type": "CourseInstance",
          "courseMode": "onsite",
          "courseWorkload": "PT90M",
          "courseSchedule": {
            "@type": "Schedule",
            "repeatFrequency": "3 times per week"
          }
        }
      },
      {
        "@type": "Course",
        "name": "Toán Lớp 11",
        "description": "Khóa học Toán lớp 11 phát triển tư duy, bao gồm Dãy số, Giới hạn, và Đạo hàm",
        "provider": {
          "@type": "Organization",
          "name": "Minh Thành Math"
        },
        "educationalLevel": "Grade 11",
        "courseCode": "TOAN11",
        "hasCourseInstance": {
          "@type": "CourseInstance",
          "courseMode": "onsite",
          "courseWorkload": "PT90M",
          "courseSchedule": {
            "@type": "Schedule",
            "repeatFrequency": "3 times per week"
          }
        }
      },
      {
        "@type": "Course",
        "name": "Toán Lớp 12 - Luyện Thi THPT",
        "description": "Khóa học Toán lớp 12 và luyện thi THPT Quốc gia, bao gồm Tích phân và Hình học không gian",
        "provider": {
          "@type": "Organization",
          "name": "Minh Thành Math"
        },
        "educationalLevel": "Grade 12",
        "courseCode": "TOAN12",
        "hasCourseInstance": {
          "@type": "CourseInstance",
          "courseMode": "onsite",
          "courseWorkload": "PT90M",
          "courseSchedule": {
            "@type": "Schedule",
            "repeatFrequency": "4 times per week"
          }
        }
      }
    ]
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Trang chủ",
        "item": "https://minhthanhmath.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Khóa học",
        "item": "https://minhthanhmath.com#courses"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Giảng viên",
        "item": "https://minhthanhmath.com#teachers"
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "Đăng ký",
        "item": "https://minhthanhmath.com#register"
      }
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(localBusinessSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(courseSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
    </Helmet>
  );
}
