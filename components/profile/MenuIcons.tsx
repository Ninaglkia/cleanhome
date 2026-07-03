import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from 'react-native-svg'

// Premium "squircle a colore pieno" menu icons — 1:1 with Claude Design
// (Profilo icone.dc.html → "Sistema icone premium"). Each tile is a
// full-saturation diagonal gradient (≈160°), white 24px glyph, a soft inner
// top light, and a COLORED drop shadow tinted to the icon's hue. Colours are
// SEMANTIC (fixed by function), not themed — only the Profilo glyph swaps
// verde↔terracotta between the cleaner and client views.

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

// ─── Shared squircle tile ──────────────────────────────────────────────────────

interface TileProps {
  size: number
  id: string
  from: string
  to: string
  shadow: string
  children: React.ReactNode
}

function Tile({ size, id, from, to, shadow, children }: TileProps) {
  const glyph = size * (24 / 46) // design: 24px glyph inside a 46px tile
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.305,
        backgroundColor: to, // lets iOS render the colored shadow
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 7,
        elevation: 5,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 46 46" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`bg_${id}`} x1="0" y1="0" x2="0.55" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          {/* luce interna — soft top sheen ≈ inset 0 1px 0 rgba(255,255,255,.45) */}
          <LinearGradient id={`li_${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.30" />
            <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="46" height="46" rx="14" fill={`url(#bg_${id})`} />
        <Rect width="46" height="46" rx="14" fill={`url(#li_${id})`} />
      </Svg>
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
        {children}
      </Svg>
    </View>
  )
}

// ─── Verde: Profilo ────────────────────────────────────────────────────────────

export function IconProfile({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="profile" from="#22C58A" to="#0E8A5C" shadow="#0E8A5C">
      <Circle cx="12" cy="8" r="3.7" fill="#fff" />
      <Path
        d="M5.2 19.4c0-3.6 3-5.6 6.8-5.6s6.8 2 6.8 5.6c0 .7-.5 1.1-1.2 1.1H6.4c-.7 0-1.2-.4-1.2-1.1Z"
        fill="#fff"
      />
    </Tile>
  )
}

// ─── Ambra: Annunci ────────────────────────────────────────────────────────────

export function IconAnnunci({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="annunci" from="#FBBE4A" to="#E0962A" shadow="#E0962A">
      <Path d="M4 9.5h3v5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" fill="#fff" />
      <Path
        d="M8 9.7 18.2 5.5A1.1 1.1 0 0 1 19.7 6.5v11a1.1 1.1 0 0 1-1.5 1L8 14.3Z"
        fill="#fff"
      />
      <Path d="M8.4 14.6 10 19.4h2.3l-1.7-4.8Z" fill="#fff" opacity="0.75" />
    </Tile>
  )
}

// ─── Teal: Identità ────────────────────────────────────────────────────────────

export function IconIdentita({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="identita" from="#1FC3B6" to="#0E8E86" shadow="#0E8E86">
      <Path
        d="M12 2.6l2.2 1.3 2.5-.2.9 2.4 2.1 1.5-.8 2.4.8 2.4-2.1 1.5-.9 2.4-2.5-.2L12 21.4l-2.2-1.3-2.5.2-.9-2.4-2.1-1.5.8-2.4-.8-2.4 2.1-1.5.9-2.4 2.5.2Z"
        fill="#fff"
      />
      <Path
        d="M9 12.2l2 2 4-4.3"
        stroke="#0E8E86"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Tile>
  )
}

// ─── Azzurro: Telefono ─────────────────────────────────────────────────────────

export function IconTelefono({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="telefono" from="#3DA6EC" to="#1C7CC0" shadow="#1C7CC0">
      <Rect x="6.5" y="2.5" width="11" height="19" rx="3" fill="#fff" />
      <Rect x="8.5" y="4.8" width="7" height="11.8" rx="1" fill="#1C7CC0" opacity="0.55" />
      <Circle cx="12" cy="19" r="1.1" fill="#1C7CC0" />
    </Tile>
  )
}

// Telefono is azzurro in BOTH views (semantic) — alias kept so existing
// imports in the client view keep resolving.
export const IconTelefonoCaldo = IconTelefono

// ─── Verde: Casa ───────────────────────────────────────────────────────────────

export function IconCasa({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="casa" from="#22C58A" to="#0E8A5C" shadow="#0E8A5C">
      <Path
        d="M4 11 12 4l8 7v8.4A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5Z"
        fill="#fff"
      />
      <Rect x="10.1" y="14" width="3.8" height="7" rx="1" fill="#0E8A5C" opacity="0.6" />
    </Tile>
  )
}

// ─── Indaco: Carta / Metodo di Pagamento ────────────────────────────────────────

export function IconCarta({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="carta" from="#6E7DC4" to="#48579E" shadow="#48579E">
      <Rect x="2.5" y="5.5" width="19" height="13" rx="2.8" fill="#fff" />
      <Rect x="2.5" y="8.6" width="19" height="3.1" fill="#48579E" />
      <Rect x="5.5" y="14" width="5.5" height="1.9" rx="0.95" fill="#48579E" opacity="0.7" />
    </Tile>
  )
}

// ─── Indaco: Privacy ───────────────────────────────────────────────────────────

export function IconPrivacy({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="privacy" from="#6E7DC4" to="#48579E" shadow="#48579E">
      <Path
        d="M12 2.6 19 5.1v6c0 4.4-3 8.1-7 9.6-4-1.5-7-5.2-7-9.6v-6L12 2.6Z"
        fill="#fff"
      />
      <Path
        d="M9 12.2l2 2 4-4.3"
        stroke="#48579E"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Tile>
  )
}

// ─── Slate: Termini ────────────────────────────────────────────────────────────

export function IconTermini({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="termini" from="#8893A8" to="#616D82" shadow="#616D82">
      <Path
        d="M7 2.6h6.2l4.8 4.8v12.1A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5V4.1A1.5 1.5 0 0 1 7 2.6Z"
        fill="#fff"
      />
      <Path d="M13 2.6V7a1 1 0 0 0 1 1h4" fill="#616D82" opacity="0.4" />
      <Rect x="9" y="12" width="6" height="1.7" rx="0.85" fill="#616D82" />
      <Rect x="9" y="15.4" width="4.4" height="1.7" rx="0.85" fill="#616D82" />
    </Tile>
  )
}

// ─── Neutro: Esci ──────────────────────────────────────────────────────────────

export function IconEsci({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="esci" from="#9BA6A0" to="#6E7872" shadow="#6E7872">
      <Path
        d="M13.5 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h6.5"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M16 8l4 4-4 4M9.5 12H20"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Tile>
  )
}

// ─── Rosso: Elimina ────────────────────────────────────────────────────────────

export function IconElimina({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="elimina" from="#F4685A" to="#DC382B" shadow="#DC382B">
      <Path
        d="M5.5 7h13l-1 12.3A2 2 0 0 1 15.5 21h-7a2 2 0 0 1-2-1.7L5.5 7Z"
        fill="#fff"
      />
      <Path d="M3.8 7h16.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <Path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M10 11v6M14 11v6" stroke="#DC382B" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </Tile>
  )
}

// ─── Terracotta: Profilo (client view) ──────────────────────────────────────────

export function IconProfileCaldo({ size = 46 }: MenuIconTileProps) {
  return (
    <Tile size={size} id="profile_caldo" from="#C79A5E" to="#8A5A2E" shadow="#8A5A2E">
      <Circle cx="12" cy="8" r="3.7" fill="#fff" />
      <Path
        d="M5.2 19.4c0-3.6 3-5.6 6.8-5.6s6.8 2 6.8 5.6c0 .7-.5 1.1-1.2 1.1H6.4c-.7 0-1.2-.4-1.2-1.1Z"
        fill="#fff"
      />
    </Tile>
  )
}
