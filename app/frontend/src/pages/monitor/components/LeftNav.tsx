import React from 'react'
import {
  Avatar,
  Tooltip,
} from '@fluentui/react-components'
import {
  MoreHorizontal20Regular,
  Search20Regular,
  Alert20Regular,
  Home20Regular,
  CompassNorthwest20Regular,
  BeakerSettings20Regular,
  Bot20Filled,
} from '@fluentui/react-icons'

const ArrowAutofitHeightInIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.8536 7.85355L16.8536 5.85355C17.0488 5.65829 17.0488 5.34171 16.8536 5.14645C16.6583 4.95118 16.3417 4.95118 16.1464 5.14645L15 6.29289V2.5C15 2.22386 14.7761 2 14.5 2C14.2239 2 14 2.22386 14 2.5V6.29289L12.8536 5.14645C12.6583 4.95118 12.3417 4.95118 12.1464 5.14645C11.9512 5.34171 11.9512 5.65829 12.1464 5.85355L14.1464 7.85355C14.3417 8.04882 14.6583 8.04882 14.8536 7.85355ZM3 5C3 3.89543 3.89543 3 5 3H9.5C9.77614 3 10 3.22386 10 3.5C10 3.77614 9.77614 4 9.5 4H5C4.44772 4 4 4.44772 4 5V15C4 15.5523 4.44772 16 5 16H9.5C9.77614 16 10 16.2239 10 16.5C10 16.7761 9.77614 17 9.5 17H5C3.89543 17 3 16.1046 3 15V5ZM16.8536 14.1464L14.8536 12.1464C14.6583 11.9512 14.3417 11.9512 14.1464 12.1464L12.1464 14.1464C11.9512 14.3417 11.9512 14.6583 12.1464 14.8536C12.3417 15.0488 12.6583 15.0488 12.8536 14.8536L14 13.7071V17.5C14 17.7761 14.2239 18 14.5 18C14.7761 18 15 17.7761 15 17.5V13.7071L16.1464 14.8536C16.3417 15.0488 16.6583 15.0488 16.8536 14.8536C17.0488 14.6583 17.0488 14.3417 16.8536 14.1464Z" fill="#424242"/>
  </svg>
)

const ArrowAutofitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.0027 3.62964L16.1419 4.80922C16.3338 5.00785 16.6503 5.01337 16.8489 4.82154C17.0476 4.62971 17.0531 4.31317 16.8612 4.11454L15.0403 2.22899C14.7454 1.92367 14.2562 1.92367 13.9613 2.22899L12.1403 4.11454C11.9485 4.31317 11.954 4.62971 12.1527 4.82154C12.3513 5.01337 12.6678 5.00785 12.8597 4.80922L14.0027 3.62559V7.49999C14.0027 7.77613 14.2266 7.99999 14.5027 7.99999C14.7789 7.99999 15.0027 7.77613 15.0027 7.49999V3.62964ZM3 5C3 3.89543 3.89543 3 5 3H9.5C9.77614 3 10 3.22386 10 3.5C10 3.77614 9.77614 4 9.5 4H5C4.44772 4 4 4.44772 4 5V15C4 15.5523 4.44772 16 5 16H9.5C9.77614 16 10 16.2239 10 16.5C10 16.7761 9.77614 17 9.5 17H5C3.89543 17 3 16.1046 3 15V5ZM16.1419 15.1908L15.0027 16.3704V12.5C15.0027 12.2239 14.7789 12 14.5027 12C14.2266 12 14.0027 12.2239 14.0027 12.5V16.3744L12.8597 15.1908C12.6678 14.9921 12.3513 14.9866 12.1527 15.1785C11.954 15.3703 11.9485 15.6868 12.1403 15.8855L13.9613 17.771C14.2562 18.0763 14.7454 18.0763 15.0403 17.771L16.8612 15.8855C17.0531 15.6868 17.0476 15.3703 16.8489 15.1785C16.6503 14.9866 16.3338 14.9921 16.1419 15.1908Z" fill="#424242"/>
  </svg>
)


function CopilotStudioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_2225_16865)">
        <g clipPath="url(#clip1_2225_16865)">
          <path d="M21.7747 1.59109C17.7707 0.256406 15.7684 -0.410548 14.3841 0.587183C13 1.58499 13 3.6954 13 7.91596V11.3326L9.77474 10.2578C5.7707 8.92308 3.76839 8.25612 2.38411 9.25385C0.999995 10.2516 1 12.362 1 16.5826V22.5279C1 24.8468 0.999868 26.0066 1.62891 26.8795C2.2581 27.7525 3.35853 28.1195 5.55859 28.8528L7.00065 29.3326L7 29.3333L11.6302 30.8762C14.0176 31.672 15.2113 32.0702 16.4056 31.8867C17.5999 31.7031 18.6192 30.9649 20.6576 29.4889L26.8652 24.9941C28.5414 23.7803 29.5236 23.0673 30.123 22.2519C30.1837 22.1727 30.2404 22.0895 30.293 22.0012C30.35 21.9097 30.404 21.8169 30.4531 21.7206C30.9999 20.6497 31 19.3979 31 16.8945V9.4713C31 7.15236 31.0002 5.99267 30.3711 5.11974C29.7419 4.24678 28.6415 3.88043 26.4414 3.14708L21.7747 1.59109Z" fill="url(#paint0_linear_2225_16865)"/>
          <path d="M21.7747 1.59109C17.7707 0.256406 15.7684 -0.410548 14.3841 0.587183C13 1.58499 13 3.6954 13 7.91596V11.3326L9.77474 10.2578C5.7707 8.92308 3.76839 8.25612 2.38411 9.25385C0.999995 10.2516 1 12.362 1 16.5826V22.5279C1 24.8468 0.999868 26.0066 1.62891 26.8795C2.2581 27.7525 3.35853 28.1195 5.55859 28.8528L7.00065 29.3326L7 29.3333L11.6302 30.8762C14.0176 31.672 15.2113 32.0702 16.4056 31.8867C17.5999 31.7031 18.6192 30.9649 20.6576 29.4889L26.8652 24.9941C28.5414 23.7803 29.5236 23.0673 30.123 22.2519C30.1837 22.1727 30.2404 22.0895 30.293 22.0012C30.35 21.9097 30.404 21.8169 30.4531 21.7206C30.9999 20.6497 31 19.3979 31 16.8945V9.4713C31 7.15236 31.0002 5.99267 30.3711 5.11974C29.7419 4.24678 28.6415 3.88043 26.4414 3.14708L21.7747 1.59109Z" fill="url(#paint1_radial_2225_16865)"/>
          <path d="M21.7747 1.59109C17.7707 0.256406 15.7684 -0.410548 14.3841 0.587183C13 1.58499 13 3.6954 13 7.91596V11.3326L9.77474 10.2578C5.7707 8.92308 3.76839 8.25612 2.38411 9.25385C0.999995 10.2516 1 12.362 1 16.5826V22.5279C1 24.8468 0.999868 26.0066 1.62891 26.8795C2.2581 27.7525 3.35853 28.1195 5.55859 28.8528L7.00065 29.3326L7 29.3333L11.6302 30.8762C14.0176 31.672 15.2113 32.0702 16.4056 31.8867C17.5999 31.7031 18.6192 30.9649 20.6576 29.4889L26.8652 24.9941C28.5414 23.7803 29.5236 23.0673 30.123 22.2519C30.1837 22.1727 30.2404 22.0895 30.293 22.0012C30.35 21.9097 30.404 21.8169 30.4531 21.7206C30.9999 20.6497 31 19.3979 31 16.8945V9.4713C31 7.15236 31.0002 5.99267 30.3711 5.11974C29.7419 4.24678 28.6415 3.88043 26.4414 3.14708L21.7747 1.59109Z" fill="url(#paint2_radial_2225_16865)"/>
          <path d="M19 18.1385C19 15.8195 19 14.6599 18.3708 13.787C17.7416 12.914 16.6416 12.5473 14.4415 11.814L9.77485 10.2584C5.77068 8.92369 3.7686 8.25633 2.3843 9.25408C1 10.2518 1 12.3622 1 16.583V22.5284C1 24.8475 1 26.007 1.62919 26.88C2.25839 27.7529 3.35842 28.1196 5.55848 28.853L10.2252 30.4085C14.2293 31.7432 16.2314 32.4106 17.6157 31.4129C19 30.4151 19 28.3047 19 24.084V18.1385Z" fill="url(#paint3_radial_2225_16865)"/>
          <path d="M19 18.1385C19 15.8195 19 14.6599 18.3708 13.787C17.7416 12.914 16.6416 12.5473 14.4415 11.814L9.77485 10.2584C5.77068 8.92369 3.7686 8.25633 2.3843 9.25408C1 10.2518 1 12.3622 1 16.583V22.5284C1 24.8475 1 26.007 1.62919 26.88C2.25839 27.7529 3.35842 28.1196 5.55848 28.853L10.2252 30.4085C14.2293 31.7432 16.2314 32.4106 17.6157 31.4129C19 30.4151 19 28.3047 19 24.084V18.1385Z" fill="url(#paint4_linear_2225_16865)"/>
          <path d="M31 22.0003V11.667L19 20.5003L1 15.3335V27.3335L16.5 32.5003L31 22.0003Z" fill="url(#paint5_radial_2225_16865)"/>
          <path d="M13.0247 5.03484C10.7678 4.35593 9.40725 4.18357 8.38411 4.92091C7.35977 5.65922 7.09367 7.00682 7.02441 9.36785C7.82118 9.60753 8.72963 9.91054 9.77441 10.2588L12.9997 11.3337V7.91668C12.9997 6.81928 13.0004 5.86448 13.0247 5.03484Z" fill="url(#paint6_linear_2225_16865)"/>
          <path d="M13.0247 5.03484C10.7678 4.35593 9.40725 4.18357 8.38411 4.92091C7.35977 5.65922 7.09367 7.00682 7.02441 9.36785C7.82118 9.60753 8.72963 9.91054 9.77441 10.2588L12.9997 11.3337V7.91668C12.9997 6.81928 13.0004 5.86448 13.0247 5.03484Z" fill="url(#paint7_linear_2225_16865)" fillOpacity="0.7"/>
          <path d="M13.0247 5.03418C13.0004 5.86374 13 6.81839 13 7.91569V13.8613C13 16.1803 13.0001 17.3399 13.6292 18.2129C14.2584 19.0858 15.3586 19.4525 17.5586 20.1859L19 20.6663C21.6676 21.5555 23.0014 22.0001 23.9467 21.3799C24.0037 21.3425 24.0591 21.3026 24.1127 21.2603C25 20.5596 25 19.1537 25 16.3418V13.8047C25 11.4856 25 10.3261 24.3708 9.45312C23.7416 8.5802 22.6414 8.21348 20.4414 7.48014L15.7747 5.92448C14.73 5.57624 13.8215 5.27384 13.0247 5.03418Z" fill="url(#paint8_linear_2225_16865)"/>
          <path d="M13.0247 5.03418C13.0004 5.86374 13 6.81839 13 7.91569V13.8613C13 16.1803 13.0001 17.3399 13.6292 18.2129C14.2584 19.0858 15.3586 19.4525 17.5586 20.1859L19 20.6663C21.6676 21.5555 23.0014 22.0001 23.9467 21.3799C24.0037 21.3425 24.0591 21.3026 24.1127 21.2603C25 20.5596 25 19.1537 25 16.3418V13.8047C25 11.4856 25 10.3261 24.3708 9.45312C23.7416 8.5802 22.6414 8.21348 20.4414 7.48014L15.7747 5.92448C14.73 5.57624 13.8215 5.27384 13.0247 5.03418Z" fill="url(#paint9_radial_2225_16865)"/>
          <path d="M7.02474 9.36816C7.00041 10.1977 7 11.1524 7 12.2497V18.1953C7 20.5144 7.00004 21.6739 7.62923 22.5469C8.25843 23.4198 9.35857 23.7865 11.5586 24.5199L12.9917 24.9976C15.6671 25.8894 17.0049 26.3353 17.9517 25.7106C18.0053 25.6752 18.0575 25.6376 18.108 25.5979C19 24.8973 19 23.4872 19 20.667V18.1387C19 15.8196 19 14.6601 18.3708 13.7871C17.7416 12.9142 16.6414 12.5475 14.4414 11.8141L9.77474 10.2585C8.73002 9.91022 7.82147 9.60782 7.02474 9.36816Z" fill="url(#paint10_linear_2225_16865)"/>
          <path d="M13 13.8613C13 16.1804 13 17.3399 13.6292 18.2129C14.2584 19.0858 15.3585 19.4525 17.5586 20.1859L19 20.6663V18.138C19 15.819 18.9999 14.6594 18.3708 13.7865C17.7416 12.9136 16.6414 12.5468 14.4414 11.8135L13 11.333V13.8613Z" fill="url(#paint11_linear_2225_16865)"/>
        </g>
      </g>
      <defs>
        <linearGradient id="paint0_linear_2225_16865" x1="18.1667" y1="25.6663" x2="27.3333" y2="3.33292" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2764E7"/>
          <stop offset="0.307475" stopColor="#8B52F4"/>
          <stop offset="0.544627" stopColor="#BB45EA"/>
          <stop offset="0.803866" stopColor="#DB56C6"/>
          <stop offset="1" stopColor="#F462AB"/>
        </linearGradient>
        <radialGradient id="paint1_radial_2225_16865" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(17.8333 14.9996) rotate(43.8065) scale(11.3162 7.1551)">
          <stop offset="0.549399" stopColor="#5B2AB5"/>
          <stop offset="1" stopColor="#A931D8" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="paint2_radial_2225_16865" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15 11.3329) rotate(17.7004) scale(16.4452 8.19879)">
          <stop offset="0.527929" stopColor="#9529C2"/>
          <stop offset="1" stopColor="#DD3CE2" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="paint3_radial_2225_16865" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20.7974 29.7793) rotate(-124.89) scale(27.3645 27.3645)">
          <stop stopColor="#2764E7"/>
          <stop offset="0.225228" stopColor="#0094F0"/>
          <stop offset="0.443437" stopColor="#19B2CE"/>
          <stop offset="0.6999" stopColor="#52D17C"/>
          <stop offset="1" stopColor="#FFD638"/>
        </radialGradient>
        <linearGradient id="paint4_linear_2225_16865" x1="6.84815" y1="27.57" x2="18.2817" y2="27.57" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16BBDA" stopOpacity="0"/>
          <stop offset="0.535279" stopColor="#0094F0"/>
          <stop offset="1" stopColor="#2764E7"/>
        </linearGradient>
        <radialGradient id="paint5_radial_2225_16865" cx="0" cy="0" r="1" gradientTransform="matrix(7.66667 4.33333 2.96958 -4.35002 14.6667 22.6668)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1B44B1"/>
          <stop offset="1" stopColor="#367AF2" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="paint6_linear_2225_16865" x1="11.5" y1="10.8337" x2="11.6667" y2="4.33366" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF9C70"/>
          <stop offset="1" stopColor="#FFD394"/>
        </linearGradient>
        <linearGradient id="paint7_linear_2225_16865" x1="9.83333" y1="8.16699" x2="9.16667" y2="11.0003" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB357" stopOpacity="0"/>
          <stop offset="1" stopColor="#F24A9D"/>
        </linearGradient>
        <linearGradient id="paint8_linear_2225_16865" x1="19.6667" y1="6.66634" x2="19.8333" y2="21.4997" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB357"/>
          <stop offset="0.380259" stopColor="#FB6F7B"/>
          <stop offset="0.659779" stopColor="#F24A9D"/>
          <stop offset="1" stopColor="#DD3CE2"/>
        </linearGradient>
        <radialGradient id="paint9_radial_2225_16865" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(13.6667 17.9997) rotate(12.702) scale(8.02985)">
          <stop offset="0.567938" stopColor="#D7257D"/>
          <stop offset="1" stopColor="#F462AB" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="paint10_linear_2225_16865" x1="17.01" y1="25.7906" x2="7" y2="8.56262" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0FAFFF"/>
          <stop offset="0.54828" stopColor="#2BDABE"/>
          <stop offset="0.765945" stopColor="#88E06C"/>
          <stop offset="1" stopColor="#FFD638"/>
        </linearGradient>
        <linearGradient id="paint11_linear_2225_16865" x1="12.3333" y1="14.833" x2="18" y2="16.833" gradientUnits="userSpaceOnUse">
          <stop stopColor="#76EB95"/>
          <stop offset="1" stopColor="#3BD5FF" stopOpacity="0"/>
        </linearGradient>
        <clipPath id="clip0_2225_16865">
          <rect width="32" height="32" fill="white"/>
        </clipPath>
        <clipPath id="clip1_2225_16865">
          <rect width="32" height="32" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  )
}

function LeftNav() {
  return (
    <nav className="w-12 flex flex-col items-center border-r border-[rgba(0,0,0,0.06)] bg-white py-2">
      <div className="flex flex-col items-center flex-1">
        {/* App Actions */}
        <div className="flex flex-col items-center gap-1">
          {/* Copilot Studio Logo */}
          <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
            <div className="flex items-center justify-center">
              <CopilotStudioIcon className="w-8 h-8" />
            </div>
          </div>
          {/* Search */}
          <Tooltip content="Search" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
              <div className="flex items-center justify-center">
                <Search20Regular className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </Tooltip>
          {/* Alert */}
          <Tooltip content="Notifications" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
              <div className="flex items-center justify-center">
                <Alert20Regular className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </Tooltip>
        </div>

        <div className="w-6 h-px bg-[rgba(0,0,0,0.06)] my-2" />

        {/* Agent Actions */}
        <div className="flex flex-col items-center gap-1">
          {/* Home */}
          <Tooltip content="Home" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
              <div className="flex items-center justify-center">
                <Home20Regular className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </Tooltip>
          {/* Compass */}
          <Tooltip content="Explore" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
              <div className="flex items-center justify-center">
                <CompassNorthwest20Regular className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </Tooltip>
          {/* Agents - Active with indicator */}
          <Tooltip content="Agents" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md bg-[hsl(var(--surface-tertiary))]">
              <div className="flex items-center justify-center">
                <Bot20Filled className="w-5 h-5 text-gray-900" />
              </div>
            </div>
          </Tooltip>
          {/* Evaluations icon */}
          <Tooltip content="Evaluations" relationship="label" positioning="after">
            <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
              <div className="flex items-center justify-center">
                <BeakerSettings20Regular className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Bottom - More menu & Account */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <Tooltip content="More options" relationship="label" positioning="after">
          <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
            <div className="flex items-center justify-center">
              <MoreHorizontal20Regular className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </Tooltip>
        <div className="w-10 h-10 flex items-center justify-center cursor-pointer rounded-md">
          <div className="flex items-center justify-center">
            <Avatar name="Palak Sanghani" size={36} />
          </div>
        </div>
      </div>
    </nav>
  )
}


export { ArrowAutofitHeightInIcon, ArrowAutofitIcon, CopilotStudioIcon }
export default LeftNav
