export function LoadingLogo({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <style>
        {`
          .wing {
            animation: wave 1.5s ease-in-out infinite;
          }
          .wing-pink { 
            transform-origin: 170px 140px;
            animation-delay: 0s; 
          }
          .wing-cyan { 
            transform-origin: 175px 165px;
            animation-delay: 0.15s; 
          }
          .wing-green { 
            transform-origin: 165px 190px;
            animation-delay: 0.3s; 
          }
          @keyframes wave {
            0% { transform: scale(0.95); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.6; }
          }
        `}
      </style>
      <path className="wing wing-pink" d="M 170,140 C 130,40 60,10 30,10 C 50,30 110,90 170,140 Z" fill="#df0f7e" />
      <path className="wing wing-cyan" d="M 175,165 C 130,120 60,100 10,100 C 40,120 110,140 175,165 Z" fill="#00b4d5" />
      <path className="wing wing-green" d="M 165,190 C 120,200 60,190 20,170 C 60,180 110,180 165,190 Z" fill="#8dc63f" />
    </svg>
  )
}
