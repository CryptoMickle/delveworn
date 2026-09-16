"use client";

import { useRef } from "react";
import "./shop-vitals.css";
import { MerchantShopArtwork } from "./merchant-art";

export function ShopVitals({ hp, maxHp, gold, potions, weapon, armor }: {
  hp: number; maxHp: number; gold: number; potions: number; weapon: number; armor: number;
}) {
  return <div className="dungeon-shop-vitals" role="group" aria-label="Your supplies at Kevin's shop">
    <span className="dungeon-shop-hp"><small>HP</small><strong>{hp} / {maxHp}</strong><span role="progressbar" aria-label="Health while shopping" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}><i style={{width:`${Math.max(0,Math.min(100,hp/maxHp*100))}%`}} /></span></span>
    <span><small>Gold</small><strong>{gold}</strong></span><span><small>Potions</small><strong>{potions} / 5</strong></span>
    <span><small>Weapon</small><strong>+{weapon}</strong></span><span><small>Armor</small><strong>+{armor}</strong></span>
  </div>;
}

export function ShopKeeper({ camp = false }: { camp?: boolean }) {
  const artwork=useRef<HTMLDetailsElement>(null);
  return <div className="dungeon-shop-keeper"><details ref={artwork} className="dungeon-shop-keeper-art" data-keyboard-actions>
    <summary aria-label="View full Quartermaster Kevin artwork"><MerchantShopArtwork /><span>View full artwork</span></summary>
    <div className="dungeon-shop-art-expanded"><button type="button" onClick={() => artwork.current?.removeAttribute("open")} aria-label="Close full Quartermaster Kevin artwork">Close artwork</button><MerchantShopArtwork /></div>
  </details><div className="dungeon-shop-keeper-copy"><p className="descent-kicker">{camp ? "CAMP BEFORE MANAGEMENT" : "SUPPLY STOP"}</p><h2>Quartermaster Kevin</h2><p>{camp ? "Rest, restock, and improve your equipment." : "Heal here or take a potion with you."}</p></div></div>;
}
