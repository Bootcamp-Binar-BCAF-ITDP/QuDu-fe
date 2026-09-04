export interface PlafondRequest {
  level: number
  description: string
  minimumAmount: number
  maxAmount: number
  minTenor: number
  maxTenor: number
  interestRate: number
  adminFee: number
}

export interface Plafond {
  plafondId: number
  level: number
  description: string
  minimumAmount: number
  maxAmount: number
  minTenor: number
  maxTenor: number
  interestRate: number
  adminFee: number
}
