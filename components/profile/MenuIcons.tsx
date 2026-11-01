import React from 'react'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { vars } from 'nativewind'
import { PColor } from '../../lib/design/pulitori'

/** One outline family and one sage surface across both profile modes. */
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

interface TileProps extends MenuIconTileProps {
  name: React.ComponentProps<typeof Ionicons>['name']
  tone?: 'default' | 'muted' | 'danger'
}

function Tile({ name, size = 44, tone = 'default' }: TileProps) {
  const color = tone === 'danger' ? PColor.error : tone === 'muted' ? PColor.body : PColor.accent
  const surface = tone === 'default' ? PColor.mintPale : PColor.canvas2

  return (
    <View
      className="h-[--menu-icon-size] w-[--menu-icon-size] items-center justify-center rounded-xl bg-[--menu-icon-surface]"
      style={vars({ '--menu-icon-size': size, '--menu-icon-surface': surface })}
      accessible={false}
    >
      <Ionicons name={name} size={Math.round(size / 2)} color={color} accessible={false} />
    </View>
  )
}

export function IconProfile(props: MenuIconTileProps) {
  return <Tile {...props} name="person-outline" />
}

export function IconAnnunci(props: MenuIconTileProps) {
  return <Tile {...props} name="megaphone-outline" />
}

export function IconIdentita(props: MenuIconTileProps) {
  return <Tile {...props} name="shield-checkmark-outline" />
}

export function IconTelefono(props: MenuIconTileProps) {
  return <Tile {...props} name="phone-portrait-outline" />
}

export function IconCasa(props: MenuIconTileProps) {
  return <Tile {...props} name="home-outline" />
}

export function IconCarta(props: MenuIconTileProps) {
  return <Tile {...props} name="card-outline" />
}

export function IconPrivacy(props: MenuIconTileProps) {
  return <Tile {...props} name="lock-closed-outline" />
}

export function IconTermini(props: MenuIconTileProps) {
  return <Tile {...props} name="document-text-outline" />
}

export function IconEsci(props: MenuIconTileProps) {
  return <Tile {...props} name="log-out-outline" tone="muted" />
}

export function IconElimina(props: MenuIconTileProps) {
  return <Tile {...props} name="trash-outline" tone="danger" />
}

// Keep legacy role-specific imports compatible with the unified identity.
export const IconProfileCaldo = IconProfile
export const IconTelefonoCaldo = IconTelefono
