# キャップは？ / thirteenth character

Reference: bright swept red hair, round brown glasses, smiling face, navy hooded sweatshirt. Original low-poly full body on existing52-hit rig; no photo texture or identity assumption.

Comparison before implementation: duelist fog/lift/dash/knives; NOPE bomb/flash/decoy; MEND slow/fog/heal; IAGNU fixed contact/flash/speed; grass fog/slow/speed; ember bomb/future-flash mitigation/reload; frost ring/fog/slow relief; duck new-skill seal/shield/quiet/lethal guard; cat return/ammo removal/gun fetch/clock pause; car push/smoke removal/movement spread/refill; nobi vulnerability/fire interval/objective acceleration/body-head conversion; Japan border crossing/armor transfer/firearm return/dead-ally muster.

|Key|New effect and operation|Counterplay|
|---|---|---|
|C スコープロック|Equip/aim visible hostile40m, left confirm/right cancel.8s prevents primary ADS. Hip fire, fire rate, ammo and skills unchanged.2x100.|Wall/smoke/flash prevents cast; use hip fire or cover. Not duck's ability seal or nobi's fire interval penalty. BOTs have no ADS; their hip fire is unchanged.|
|Q クリアテイク|Equip/aim visible ally24m, left confirm/right cancel; self fallback when no ally aimed. Remove current blind and hostile targeted skill debuffs. No HP/armor/ammo change or future immunity.1x100.|Only current effects; standing in fields can reapply slow. Not future flash mitigation, healing or smoke deletion. No cast/stock use without a removable effect.|
|E バンクレンズ|Self6s/22sCD. Gun hits on vertical solid surfaces reflect once,75% damage, total path<=90m. Physical ray/cover/decoys/shields still block. No target seeking.|Predict bounce geometry; second walls stop; never reflects knives/ULT projectiles; no invented enemy position or repeated bounce. Not damage reflection (Japan), moving spread (car) or damage multiplication (nobi).|
|X エンドレスマガジン|7pt9s self. Existing loaded firearm bullets are fired without decrement. Cadence/recoil/spread/aim and reserve unchanged. Does not load an empty gun; normal reload still transfers finite reserve.|Enemy can wait or force reload. No new ammunition, refill, fire-rate buff or head conversion; differs from ember's one finite reload/car ordinary-skill refill.|

Host decides targeting, cleansing, ricochet hit/HP and ammo preservation. Guest predicts ability stock only; uses authoritative events for gun behavior. Twenty event cap rejects before mutation. Strict target IDs/times/coordinates; own death/team/round/menu cleanup. Existing12 models, floors and gun/step sounds unchanged. No UI superiority label.
