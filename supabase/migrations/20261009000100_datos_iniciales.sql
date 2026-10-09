-- =====================================================================
-- Lista de Turno · datos iniciales
-- Empleados de prueba y tareas de cada puesto. Solo se insertan si
-- las tablas están vacías, así que es seguro volver a ejecutarlo.
-- =====================================================================

do $$
declare
  v_id uuid;
  r record;
begin
  if not exists (select 1 from public.empleados) then
    for r in select * from (values ('Daniel', '1111'), ('Camila', '2222'), ('Junior', '3333')) as t(nombre, pin) loop
      insert into public.empleados (nombre) values (r.nombre) returning id into v_id;
      insert into public.empleados_pin (empleado_id, pin_hash)
      values (v_id, extensions.crypt(r.pin, extensions.gen_salt('bf')));
    end loop;
  end if;

  if not exists (select 1 from public.tareas) then
    insert into public.tareas (rol, bloque, orden, texto)
    select t.rol, t.bloque, row_number() over (partition by t.rol, t.bloque order by t.n), t.texto
    from (values
      -- TAQUERO
      ( 1, 'taquero', 'apertura', 'Revisar que estén todas las proteínas del día y su estado'),
      ( 2, 'taquero', 'apertura', 'Poner las proteínas en los asafates calientes'),
      ( 3, 'taquero', 'apertura', 'Alistar los salseros'),
      ( 4, 'taquero', 'apertura', 'Probar cada proteína y salsa antes de abrir'),
      ( 5, 'taquero', 'servicio', 'Armar los tacos según las comandas'),
      ( 6, 'taquero', 'servicio', 'Armar nachos y papas'),
      ( 7, 'taquero', 'servicio', 'Rellenar los salseros cuando bajen'),
      ( 8, 'taquero', 'servicio', 'Revisar las proteínas en los asafates y reponer si se acaban'),
      ( 9, 'taquero', 'cierre', 'Guardar y rotular las proteínas sobrantes'),
      (10, 'taquero', 'cierre', 'Dejar limpia y ordenada su estación'),
      (11, 'taquero', 'cierre', 'Contar proteínas y salsas para el inventario'),
      -- TORTILLERO
      (12, 'tortillero', 'apertura', 'Echar agua al samovar para calentar el baño maría'),
      (13, 'tortillero', 'apertura', 'Encender y revisar el horno y la parrilla'),
      (14, 'tortillero', 'apertura', 'Preparar y contar las tortillas del día'),
      (15, 'tortillero', 'servicio', 'Calentar tortillas al ritmo de las comandas'),
      (16, 'tortillero', 'servicio', 'Estar pendiente del horno y la parrilla'),
      (17, 'tortillero', 'servicio', 'Avisar al taquero cuando vayan quedando pocas tortillas'),
      (18, 'tortillero', 'cierre', 'Apagar el horno y la parrilla'),
      (19, 'tortillero', 'cierre', 'Limpiar horno, parrilla y su estación'),
      (20, 'tortillero', 'cierre', 'Contar las tortillas sobrantes'),
      -- AUXILIAR
      (21, 'auxiliar', 'apertura', 'Abrir el servicio y encender los equipos'),
      (22, 'auxiliar', 'apertura', 'Alistar platos y utensilios limpios'),
      (23, 'auxiliar', 'apertura', 'Verificar insumos de cada estación (servilletas, empaques, salsas)'),
      (24, 'auxiliar', 'servicio', 'Lavar platos y utensilios'),
      (25, 'auxiliar', 'servicio', 'Reponer insumos donde hagan falta'),
      (26, 'auxiliar', 'servicio', 'Apoyar la estación que se atrase'),
      (27, 'auxiliar', 'servicio', 'Sacar la basura cuando se llene'),
      (28, 'auxiliar', 'cierre', 'Lavar los últimos platos y utensilios'),
      (29, 'auxiliar', 'cierre', 'Hacer el aseo general: pisos, mesas y cocina'),
      (30, 'auxiliar', 'cierre', 'Sacar la basura final'),
      -- CAJERO
      (31, 'cajero', 'apertura', 'Abrir caja y contar la base'),
      (32, 'cajero', 'apertura', 'Encender el POS y el datáfono y probar que funcionen'),
      (33, 'cajero', 'apertura', 'Confirmar con cocina qué productos hay disponibles hoy'),
      (34, 'cajero', 'servicio', 'Tomar los pedidos y cobrar'),
      (35, 'cajero', 'servicio', 'Pasar las comandas a cocina sin demora'),
      (36, 'cajero', 'servicio', 'Verificar que cada pedido salga completo y bien armado antes de entregarlo'),
      (37, 'cajero', 'servicio', 'Avisar a cocina y a los clientes cuando se agote un producto'),
      (38, 'cajero', 'cierre', 'Hacer el cuadre de caja'),
      (39, 'cajero', 'cierre', 'Hacer el inventario del día'),
      (40, 'cajero', 'cierre', 'Anotar lo que falta para mañana')
    ) as t(n, rol, bloque, texto);
  end if;
end;
$$;
