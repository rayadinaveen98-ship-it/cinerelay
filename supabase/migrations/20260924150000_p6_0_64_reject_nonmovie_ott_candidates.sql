begin;

update public.entity_discovery_candidates c
set status = 'REJECTED',
    reviewed_by = null,
    reviewed_at = now(),
    review_reason = 'P6.0.64 rejected legacy OTT movie-discovery noise with strong series/show/promo evidence markers',
    updated_at = now()
where c.status in ('PENDING','REVIEWING')
  and c.metadata ->> 'signalType' = 'OTT_RELEASE'
  and c.first_party_source_count > 0
  and exists (
    select 1
    from public.entity_discovery_evidence e
    join public.raw_items r on r.id = e.raw_item_id
    where e.candidate_id = c.id
      and e.is_first_party = true
      and (
        coalesce(r.raw_title, '') ~* '(Hotstar[[:space:]]+Specials|Season[[:space:]]*[0-9]+|Episodes?[[:space:]]*[0-9]*|Ep\.?[[:space:]]*[0-9]+|Web[[:space:]]*Series|Webseries|TV[[:space:]]+Show|Reality[[:space:]]+Show|Game[[:space:]]+Show|Serial|Week[[:space:]]*[0-9]+[[:space:]]*[-–—][[:space:]]*Promo|Sat[[:space:]]*[-–—][[:space:]]*Sun|Mon[[:space:]]*[-–—][[:space:]]*Fri|Sign[[:space:]]+up[[:space:]]+for[[:space:]]+Sony[[:space:]]+LIV)'
        or left(coalesce(r.raw_text, ''), 700) ~* '#(HotstarSpecials|[^[:space:]#]*Season[0-9]+|[^[:space:]#]*S[0-9]+On(JHS|JioHotstar)|Webseries)'
      )
  );

commit;
