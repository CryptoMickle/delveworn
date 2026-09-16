import Image from "next/image";
import "./shop-vitals.css";

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
  return <div className="dungeon-shop-keeper"><div className="dungeon-shop-keeper-art"><Image src="/characters/merchant-quartermaster-kevin.webp" alt="Quartermaster Kevin with his wagon and no-refunds sign" width={1672} height={941} sizes="(max-width: 760px) calc(100vw - 48px), 460px" /></div><div><p className="descent-kicker">{camp ? "CAMP BEFORE MANAGEMENT" : "SUPPLY STOP"}</p><h2>Quartermaster Kevin</h2><p>{camp ? "Rest, restock, and improve your equipment." : "Heal here or take a potion with you."}</p></div></div>;
}
