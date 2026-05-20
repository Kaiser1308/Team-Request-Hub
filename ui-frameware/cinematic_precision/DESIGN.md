---
name: Cinematic Precision
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1b1b1b'
  on-surface-variant: '#4c4546'
  inverse-surface: '#303030'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#005ab7'
  on-secondary: '#ffffff'
  secondary-container: '#0372e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1b1b'
  on-tertiary-container: '#848484'
  error: '#ff3b30'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#abc7ff'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#00458f'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c6'
  on-tertiary-fixed: '#1b1b1b'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1b1b1b'
  surface-variant: '#e2e2e2'
  surface-alt: '#f5f5f7'
  text-primary: '#1d1d1f'
  text-secondary: '#86868b'
  link: '#0066cc'
  success: '#28a745'
  warning: '#ff9f0a'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '600'
    lineHeight: '1.07'
    letterSpacing: -0.005em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Inter
    fontSize: 21px
    fontWeight: '400'
    lineHeight: '1.19'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.47'
    letterSpacing: -0.022em
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '0'
  caption-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

# Design System: Team Request Hub (Apple-Inspired)

## Visual Theme & Atmosphere
Controlled drama, cinematic pacing, and minimalism. High contrast between pure black and light gray sections. Reductive interface that retreats to let the product (the Request) shine.

## Color Palette

### Primary
- **Pure Black** (`#000000`): Hero backgrounds, immersive sections.
- **Light Gray** (`#f5f5f7`): Main dashboard background, informational cards.
- **Near Black** (`#1d1d1f`): Primary text on light backgrounds.

### Interactive
- **Apple Blue** (`#0071e3`): Primary buttons, interactive states, focus rings.
- **Link Blue** (`#0066cc`): Standard inline links.

### Semantic (Status/Priority)
- **Pending**: Soft Gray (`#86868b`)
- **Acknowledged**: Link Blue (`#0066cc`)
- **In Progress**: Apple Blue (`#0071e3`)
- **Done**: Green (`#28a745`) - *Modified from pure Apple to include success/error for technical tools*
- **Cancelled/Urgent**: Red (`#ff3b30`)
- **High/Medium Priority**: Amber/Orange (`#ff9f0a`)

### Shadows
- **Card Shadow**: `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px`

## Typography (SF Pro Inspired)
- **Headline**: 56px Semibold, Line-height 1.07, Letter-spacing -0.28px.
- **Subheading**: 21px Regular, Line-height 1.19.
- **Body**: 17px Regular, Line-height 1.47, Letter-spacing -0.374px.
- **Small/Label**: 14px Semibold/Regular.

## Component Styles
- **Buttons**: Pill-shaped (980px radius) for links/CTAs. 8px radius for standard actions.
- **Cards**: #f5f5f7 background, 8px radius, soft shadow if elevated.
- **Navigation**: Sticky, `rgba(0,0,0,0.8)` with backdrop blur.
- **Badges**: Small rounded chips, minimal color, high readability.
