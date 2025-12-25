import { Phone } from "lucide-react";

export function FloatingContact() {
  const phoneNumberClean = "0964345413";
  const facebookUrl = "https://www.facebook.com/minhthanhmath";
  const zaloUrl = "https://zalo.me/0964345413";

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col gap-3">
      {/* Phone Button */}
      <a
        href={`tel:${phoneNumberClean}`}
        className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
        aria-label="Gọi điện thoại 0964345413"
      >
        <Phone className="text-white" size={24} />
      </a>

      {/* Facebook Messenger Button */}
      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
        aria-label="Chat qua Facebook Messenger"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          className="w-7 h-7"
        >
          <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.896 1.428 5.48 3.663 7.18V22l3.406-1.87c.91.252 1.875.384 2.931.384 5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2zm.994 12.408l-2.549-2.718-4.974 2.718 5.47-5.804 2.61 2.718 4.913-2.718-5.47 5.804z"/>
        </svg>
      </a>

      {/* Zalo Button */}
      <a
        href={zaloUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300"
        aria-label="Chat qua Zalo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          fill="white"
          className="w-7 h-7"
        >
          <path d="M24 4C13.5 4 5 11.9 5 21.7c0 6.1 3.4 11.5 8.5 14.8l-.3 5.3 5.5-2.9c2 .6 4.2.9 6.3.9 10.5 0 19-7.9 19-17.7S34.5 4 24 4zm.1 28.1c-1.8 0-3.5-.3-5.1-.8l-3.7 1.9.2-3.6c-3.6-2.4-6-6.3-6-10.7 0-7.2 6.4-13.1 14.3-13.1s14.3 5.9 14.3 13.1-6.4 13.2-14 13.2z"/>
          <path d="M18.9 19.8h-1.6v5.1h1.6v-5.1zm3.2 0h-1.6v5.1h1.6v-5.1zm5.8 3.9l-2.3-3.9h-1.7v5.1h1.6v-3.6l2.2 3.6h1.7v-5.1h-1.6v3.9z"/>
        </svg>
      </a>
    </div>
  );
}