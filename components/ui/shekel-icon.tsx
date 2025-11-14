import * as React from "react";
import { SVGProps } from "react";

const ShekelIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6 11h8a4 4 0 0 0 0-8h-4" />
    <path d="M18 13h-8a4 4 0 0 1 0-8h4" />
    <path d="M10 3v18" />
    <path d="M14 3v18" />
  </svg>
);

export default ShekelIcon;