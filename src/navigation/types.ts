import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type AuthStackParamList = {
  Login: undefined
  ForgotPassword: undefined
  ResetPassword: { token?: string } | undefined
}

export type AdminStackParamList = {
  AdminHome: undefined
  Categories: undefined
  Products: undefined
  Addons: undefined
  Staff: undefined
  Tables: undefined
  Settings: undefined
}

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>

export type AdminScreenProps<T extends keyof AdminStackParamList> = NativeStackScreenProps<
  AdminStackParamList,
  T
>
