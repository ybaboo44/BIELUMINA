import { describe, expect, it } from 'vitest'
import { canTransition, convertPrice, orderTotal } from './commerce'

describe('conversion HTG / USD',()=>{
 it('convertit 2 700 HTG en 20 USD au taux de 135',()=>expect(convertPrice(2700,'HTG',135)).toBe(20))
 it('convertit 20 USD en 2 700 HTG',()=>expect(convertPrice(20,'USD',135)).toBe(2700))
 it('refuse un taux nul',()=>expect(()=>convertPrice(20,'USD',0)).toThrow())
})
describe('totaux de commande',()=>{
 it('calcule le total exact avec livraison et remise',()=>expect(orderTotal(4800,250,100)).toBe(4950))
 it('refuse un total négatif',()=>expect(()=>orderTotal(100,0,200)).toThrow())
})
describe('cycle de vie des commandes',()=>{
 it('autorise le flux normal',()=>{expect(canTransition('pending_confirmation','confirmed')).toBe(true);expect(canTransition('confirmed','processing')).toBe(true);expect(canTransition('shipped','delivered')).toBe(true)})
 it('interdit le retour de livrée à en préparation',()=>expect(canTransition('delivered','processing')).toBe(false))
 it('interdit de confirmer une commande annulée',()=>expect(canTransition('cancelled','confirmed')).toBe(false))
})
