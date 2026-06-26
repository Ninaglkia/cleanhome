import React from 'react'
import { View } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from 'react-native-svg'

export type MenuIconKey =
  | 'profile'
  | 'annunci'
  | 'identita'
  | 'telefono'
  | 'privacy'
  | 'termini'
  | 'esci'
  | 'elimina'
  | 'profile-caldo'
  | 'telefono-caldo'
  | 'casa'
  | 'carta'

interface MenuIconTileProps {
  size?: number
}

// ─── Verde: IconProfile ────────────────────────────────────────────────────────

export function IconProfile({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_profile" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EFF8F3" />
            <Stop offset="1" stopColor="#DDF0E7" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_profile)" />
        <Circle cx="23" cy="18.6" r="3.9" fill="#0E9C6E" />
        <Path
          d="M16 30.2c0-3.7 3.1-5.8 7-5.8s7 2.1 7 5.8c0 .8-.6 1.2-1.3 1.2H17.3c-.7 0-1.3-.4-1.3-1.2Z"
          fill="#0E9C6E"
        />
      </Svg>
    </View>
  )
}

// ─── Verde: IconAnnunci ────────────────────────────────────────────────────────

export function IconAnnunci({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_annunci" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FBF3E2" />
            <Stop offset="1" stopColor="#F7E9CC" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_annunci)" />
        <Rect x="14" y="20" width="3.2" height="6" rx="1.2" fill="#DD9A2E" />
        <Path
          d="M17 20.4 29.4 16.2A1.2 1.2 0 0 1 31 17.4v11.2a1.2 1.2 0 0 1-1.6 1.1L17 25.6Z"
          fill="#DD9A2E"
        />
        <Path
          d="M18.4 26 20.3 30.6h2.3L20.7 26Z"
          fill="#DD9A2E"
          opacity="0.7"
        />
      </Svg>
    </View>
  )
}

// ─── Verde: IconIdentita ───────────────────────────────────────────────────────

export function IconIdentita({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_identita" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E8F6F5" />
            <Stop offset="1" stopColor="#D6EEEC" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_identita)" />
        <Path
          d="M23 13.6l2.2 1.3 2.5-.2.9 2.4 2.1 1.5-.8 2.4.8 2.4-2.1 1.5-.9 2.4-2.5-.2L23 32.4l-2.2-1.3-2.5.2-.9-2.4-2.1-1.5.8-2.4-.8-2.4 2.1-1.5.9-2.4 2.5.2Z"
          fill="#0FA39A"
        />
        <Path
          d="M20 23.2l2 2 4-4.3"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

// ─── Verde: IconTelefono ───────────────────────────────────────────────────────

export function IconTelefono({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_telefono" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#EFF8F3" />
            <Stop offset="1" stopColor="#DDF0E7" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_telefono)" />
        <Rect x="17.5" y="13.5" width="11" height="19" rx="3.2" fill="#0E9C6E" />
        <Rect x="19.4" y="15.7" width="7.2" height="12.2" rx="1" fill="#fff" opacity="0.5" />
        <Circle cx="23" cy="30.1" r="1.1" fill="#fff" />
      </Svg>
    </View>
  )
}

// ─── Slate: IconPrivacy ────────────────────────────────────────────────────────

export function IconPrivacy({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_privacy" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F0F3F8" />
            <Stop offset="1" stopColor="#E5EBF4" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_privacy)" />
        <Path
          d="M23 13.6 30 16.1v6c0 4.4-3 8.1-7 9.6-4-1.5-7-5.2-7-9.6v-6L23 13.6Z"
          fill="#5A6B86"
        />
        <Path
          d="M20 23.2l2 2 4-4.3"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

// ─── Slate: IconTermini ────────────────────────────────────────────────────────

export function IconTermini({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_termini" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F0F3F8" />
            <Stop offset="1" stopColor="#E5EBF4" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_termini)" />
        <Path
          d="M18 13.6h6.2l4.8 4.8v12.1A1.5 1.5 0 0 1 27.5 32h-9A1.5 1.5 0 0 1 17 30.5V15.1A1.5 1.5 0 0 1 18 13.6Z"
          fill="#5A6B86"
        />
        <Path d="M24 13.6V18a1 1 0 0 0 1 1h4" fill="#fff" opacity="0.35" />
        <Rect x="20" y="23" width="6" height="1.7" rx="0.85" fill="#fff" />
        <Rect x="20" y="26.4" width="4.4" height="1.7" rx="0.85" fill="#fff" />
      </Svg>
    </View>
  )
}

// ─── Neutral: IconEsci ────────────────────────────────────────────────────────

export function IconEsci({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_esci" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F1F4F3" />
            <Stop offset="1" stopColor="#E6ECEA" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_esci)" />
        <Path
          d="M24.5 14.5H18A2.5 2.5 0 0 0 15.5 17v12A2.5 2.5 0 0 0 18 31.5h6.5"
          stroke="#51606B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M27 19l4 4-4 4"
          stroke="#51606B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M20.5 23H31"
          stroke="#51606B"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

// ─── Red: IconElimina ─────────────────────────────────────────────────────────

export function IconElimina({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_elimina" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FDEEEC" />
            <Stop offset="1" stopColor="#FAE0DC" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_elimina)" />
        <Path
          d="M16.5 18h13l-1 12.3A2 2 0 0 1 26.5 32h-7a2 2 0 0 1-2-1.7L16.5 18Z"
          fill="#E0382B"
        />
        <Path
          d="M14.8 18h16.4"
          stroke="#E0382B"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M20 18V16.5A1.5 1.5 0 0 1 21.5 15h3A1.5 1.5 0 0 1 26 16.5V18"
          stroke="#E0382B"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M21 22v6"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M25 22v6"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  )
}

// ─── Caldo: IconProfileCaldo ──────────────────────────────────────────────────

export function IconProfileCaldo({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_profile_caldo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F8F0E5" />
            <Stop offset="1" stopColor="#F0E1CE" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_profile_caldo)" />
        <Circle cx="23" cy="18.6" r="3.9" fill="#A9743F" />
        <Path
          d="M16 30.2c0-3.7 3.1-5.8 7-5.8s7 2.1 7 5.8c0 .8-.6 1.2-1.3 1.2H17.3c-.7 0-1.3-.4-1.3-1.2Z"
          fill="#A9743F"
        />
      </Svg>
    </View>
  )
}

// ─── Caldo: IconTelefonoCaldo ─────────────────────────────────────────────────

export function IconTelefonoCaldo({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_telefono_caldo" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F8F0E5" />
            <Stop offset="1" stopColor="#F0E1CE" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_telefono_caldo)" />
        <Rect x="17.5" y="13.5" width="11" height="19" rx="3.2" fill="#A9743F" />
        <Rect x="19.4" y="15.7" width="7.2" height="12.2" rx="1" fill="#fff" opacity="0.5" />
        <Circle cx="23" cy="30.1" r="1.1" fill="#fff" />
      </Svg>
    </View>
  )
}

// ─── Caldo: IconCasa ──────────────────────────────────────────────────────────

export function IconCasa({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_casa" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F8F0E5" />
            <Stop offset="1" stopColor="#F0E1CE" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_casa)" />
        <Path
          d="M15 22 23 15l8 7v8.4A1.5 1.5 0 0 1 29.5 32h-13A1.5 1.5 0 0 1 15 30.5Z"
          fill="#A9743F"
        />
        <Path
          d="M14 22.6 23 14.6l9 8"
          stroke="#A9743F"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Rect x="21.1" y="25" width="3.8" height="7" rx="1" fill="#fff" opacity="0.55" />
      </Svg>
    </View>
  )
}

// ─── Caldo: IconCarta ─────────────────────────────────────────────────────────

export function IconCarta({ size = 46 }: MenuIconTileProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46">
        <Defs>
          <LinearGradient id="grad_carta" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F8F0E5" />
            <Stop offset="1" stopColor="#F0E1CE" />
          </LinearGradient>
        </Defs>
        <Rect width={46} height={46} rx={15} fill="url(#grad_carta)" />
        <Rect x="13.5" y="16.5" width="19" height="13" rx="2.8" fill="#A9743F" />
        <Rect x="13.5" y="19.6" width="19" height="3.1" fill="#7E5530" />
        <Rect x="16.5" y="25" width="5.5" height="1.9" rx="0.95" fill="#fff" opacity="0.75" />
      </Svg>
    </View>
  )
}
