-- Run against the local disposable database after the migration.
do $$ begin
 if abs(public.explicit_invoice_price_per_lb('garlic',5,'LB',18)-3.6)>0.00001 then raise exception 'per pound conversion'; end if;
 if abs(public.explicit_invoice_price_per_lb('duck IN TOTAL: 8.830 LB',1,'CS',120.53)-13.65)>0.001 then raise exception 'catch weight'; end if;
 if abs(public.explicit_invoice_price_per_lb('12X2 LBS RED CURRY',1,'CASE',60)-2.5)>0.00001 then raise exception 'case pack'; end if;
 if abs(public.explicit_invoice_price_per_lb('24X16 OZ TAMARIND',1,'CASE',58)-58.0/24)>0.00001 then raise exception 'ounce pack'; end if;
 if abs(public.explicit_invoice_price_per_lb('item',16,'OZ',10)-10)>0.00001 then raise exception 'oz conversion'; end if;
 if public.explicit_invoice_price_per_lb('chicken #40',1,'CS',64) is not null then raise exception 'ambiguous case guessed'; end if;
 if public.explicit_invoice_price_per_lb('each',1,'EA',10) is not null then raise exception 'each guessed'; end if;
 if public.explicit_invoice_price_per_lb('credit',1,'LB',-5) is not null then raise exception 'credit cost'; end if;
 if public.explicit_invoice_price_per_lb('weight',0,'LB',5) is not null then raise exception 'zero quantity'; end if;
end $$;
