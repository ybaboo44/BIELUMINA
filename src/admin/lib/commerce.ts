import type { Currency, Status } from '../types'

export function convertPrice(amount:number, from:Currency, rate:number):number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error('Montant ou taux invalide')
  return Math.round((from === 'HTG' ? amount / rate : amount * rate) * 100) / 100
}
export function orderTotal(subtotal:number, shipping:number, discount=0):number {
  const total = subtotal + shipping - discount
  if (total < 0) throw new Error('Le total ne peut pas être négatif')
  return Math.round(total * 100) / 100
}
export function canTransition(from:Status, to:Status):boolean {
  const allowed:Record<Status,Status[]> = { pending_confirmation:['confirmed','cancelled'], confirmed:['processing','cancelled'], processing:['ready_for_delivery','cancelled'], ready_for_delivery:['shipped'], shipped:['delivered'], delivered:[], cancelled:[] }
  return allowed[from].includes(to)
}
export function money(value:number|null|undefined, currency:Currency='HTG') {
  return new Intl.NumberFormat('fr-HT',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value||0))
}
export function shortMoney(value:number) { return new Intl.NumberFormat('fr-FR',{notation:'compact',maximumFractionDigits:1}).format(value) }
export function dateFr(value:string) { return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)) }
export function slugify(value:string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') }
