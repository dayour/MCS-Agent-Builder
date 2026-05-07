import React, { useId } from 'react';

interface DigitalWorkerIconProps {
  size?: number;
  variant?: 'color' | 'regular' | 'filled';
  className?: string;
  style?: React.CSSProperties;
}

const REGULAR_PATH = "M10 0C10.4142 0 10.75 0.335786 10.75 0.75C10.75 1.16421 10.4142 1.5 10 1.5C5.30558 1.5 1.5 5.30558 1.5 10C1.5 12.2819 2.40025 14.3514 3.86426 15.8789C4.12137 16.1503 4.36626 16.3734 4.65723 16.583C5.33849 17.0738 6.12386 17.0806 6.81348 16.7383C7.51614 16.3893 8.09873 15.6812 8.27832 14.7842L10.251 4.92188C10.5225 3.56531 11.4042 2.4723 12.5195 1.91992C13.6482 1.361 15.0346 1.35286 16.2178 2.20508C16.5051 2.41207 16.7535 2.63591 16.9775 2.85254C17.0124 2.8771 17.046 2.90436 17.0771 2.93555C18.8822 4.74386 20 7.24209 20 10C20 15.5228 15.5228 20 10 20C9.58579 20 9.25 19.6642 9.25 19.25C9.25 18.8358 9.58579 18.5 10 18.5C14.6944 18.5 18.5 14.6944 18.5 10C18.5 7.79992 17.6648 5.79604 16.293 4.28613C15.9637 3.95137 15.684 3.67014 15.3408 3.42285C14.6589 2.93154 13.8744 2.92353 13.1855 3.26465C12.4835 3.61236 11.9012 4.31949 11.7217 5.2168L9.74902 15.0781C9.47755 16.4347 8.59482 17.5284 7.47949 18.082C6.35087 18.6422 4.964 18.6526 3.78027 17.7998C3.51575 17.6092 3.2854 17.4112 3.06738 17.2021C3.04831 17.1869 3.02958 17.1708 3.01172 17.1533C1.15434 15.3385 0 12.8032 0 10C0 4.47715 4.47715 0 10 0Z";

const FILLED_PATH = "M10 0C10.8576 0 11.6901 0.107492 12.4844 0.310547C12.2565 0.387497 12.0339 0.478829 11.8193 0.585938C10.2937 1.34752 9.14011 2.82957 8.78027 4.62695L6.80664 14.4893C6.71531 14.9454 6.43337 15.2562 6.16992 15.3877C6.04535 15.4498 5.94342 15.4632 5.87109 15.459C5.80795 15.4553 5.71631 15.4363 5.5918 15.3467L5.58984 15.3486C5.46111 15.2568 5.30394 15.2021 5.13379 15.2021C4.69925 15.2023 4.34668 15.5547 4.34668 15.9893C4.34677 16.2153 4.44361 16.4175 4.59668 16.5605C4.63254 16.5894 4.66774 16.6196 4.70508 16.6465C5.38023 17.1326 6.14691 17.1289 6.82422 16.7764C7.51792 16.4151 8.09691 15.6903 8.27832 14.7842L10.252 4.92188C10.5225 3.57016 11.3952 2.46602 12.5029 1.89844C13.6256 1.32334 15.0123 1.29512 16.2012 2.15137C16.4833 2.3547 16.7411 2.60101 16.9648 2.82715C17.0856 2.94438 17.2026 3.06533 17.3174 3.18848C17.3329 3.20443 17.3484 3.22026 17.3633 3.23535L17.3613 3.23633C18.9986 5.01659 20 7.39056 20 10C20 15.5228 15.5228 20 10 20C9.14233 20 8.31 19.8916 7.51562 19.6885C7.7431 19.6116 7.96542 19.521 8.17969 19.4141C9.70563 18.6524 10.86 17.1699 11.2197 15.3721L13.1924 5.50977C13.2838 5.05402 13.5658 4.74382 13.8291 4.6123C13.9538 4.55005 14.0565 4.53585 14.1289 4.54004C14.192 4.54377 14.2838 4.56285 14.4082 4.65234L14.4111 4.64746C14.5452 4.75327 14.7125 4.81934 14.8965 4.81934C15.331 4.81931 15.6834 4.46675 15.6836 4.03223C15.6836 3.75701 15.5421 3.51471 15.3281 3.37402L15.3291 3.37207C15.3278 3.37112 15.3265 3.37009 15.3252 3.36914C14.6492 2.88211 13.8727 2.88194 13.1865 3.2334C12.4854 3.59278 11.9031 4.31472 11.7227 5.2168L9.74902 15.0781C9.47939 16.4256 8.61716 17.5344 7.5166 18.1074C6.39958 18.6888 5.01779 18.7201 3.82812 17.8633C3.81701 17.8553 3.80604 17.8461 3.79492 17.8379C3.7893 17.8334 3.78393 17.8297 3.77832 17.8252C3.66996 17.744 3.56283 17.6526 3.45898 17.5596C3.18235 17.32 2.91879 17.0659 2.66992 16.7979L2.62305 16.75L2.62402 16.748C0.99512 14.9697 0 12.6018 0 10C0 4.47715 4.47715 0 10 0Z";

/**
 * Digital Worker icon from the Figma design system.
 * Three variants: color (gradient), regular (outline), filled (solid).
 * Regular and filled use currentColor so they inherit text color.
 */
export const DigitalWorkerIcon: React.FC<DigitalWorkerIconProps> = ({ size = 20, variant = 'color', className, style }) => {
  const uid = useId().replace(/:/g, '');
  if (variant === 'color') {
    const bgId = `dw-bg-${uid}`;
    const swirlId = `dw-swirl-${uid}`;
    const overlayId = `dw-overlay-${uid}`;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
        <circle cx="12" cy="12" r="12" fill={`url(#${bgId})`} />
        <path d="M12 0C15.4951 0 18.6399 1.49542 20.833 3.87988C20.4186 3.46234 19.9369 3.06423 19.4248 2.69531C17.005 0.952002 13.8642 2.67908 13.2793 5.60352L10.7207 18.3965C10.1358 21.3209 6.99496 23.048 4.5752 21.3047C4.05672 20.9311 3.56917 20.5278 3.15137 20.1045C1.19469 17.9693 0 15.1244 0 12C0 5.37258 5.37258 0 12 0Z" fill={`url(#${swirlId})`} />
        <path d="M12 0C15.4951 0 18.6399 1.49542 20.833 3.87988C20.4186 3.46234 19.9369 3.06423 19.4248 2.69531C17.005 0.952002 13.8642 2.67908 13.2793 5.60352L10.7207 18.3965C10.1358 21.3209 6.99496 23.048 4.5752 21.3047C4.05672 20.9311 3.56917 20.5278 3.15137 20.1045C1.19469 17.9693 0 15.1244 0 12C0 5.37258 5.37258 0 12 0Z" fill={`url(#${overlayId})`} />
        <defs>
          <radialGradient id={bgId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(13.5 0.9) rotate(95.9315) scale(23.2243 15.5733)">
            <stop stopColor="#16BBDA" />
            <stop offset="0.689536" stopColor="#52D17C" />
            <stop offset="1" stopColor="#96EB76" />
          </radialGradient>
          <radialGradient id={swirlId} cx="0" cy="0" r="1" gradientTransform="matrix(-18.2289 -12.7314 11.503 -16.8371 18.5182 18.4315)" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2052CB" />
            <stop offset="0.662725" stopColor="#0094F0" />
            <stop offset="0.881247" stopColor="#16BBDA" />
            <stop offset="1" stopColor="#43E5CA" />
          </radialGradient>
          <linearGradient id={overlayId} x1="5.20825" y1="8.70018" x2="13.655" y2="13.4002" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0094F0" stopOpacity="0" />
            <stop offset="1" stopColor="#2052CB" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  const path = variant === 'regular' ? REGULAR_PATH : FILLED_PATH;
  return (
    <svg width={size} height={size} viewBox="-2 -2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      <path d={path} fill="currentColor" />
    </svg>
  );
};

/** Drop-in for domainIconMap — Regular variant. viewBox padded to match Fluent icon proportions (content fills ~80% of viewBox). */
export const DigitalWorker20Regular: React.FC<{ className?: string; style?: React.CSSProperties }> = (props) => (
  <svg width="1em" height="1em" viewBox="-2 -2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d={REGULAR_PATH} fill="currentColor" />
  </svg>
);

/** Drop-in for domainIconMap — Filled variant. viewBox padded to match Fluent icon proportions. */
export const DigitalWorker20Filled: React.FC<{ className?: string; style?: React.CSSProperties }> = (props) => (
  <svg width="1em" height="1em" viewBox="-2 -2 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d={FILLED_PATH} fill="currentColor" />
  </svg>
);
