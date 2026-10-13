# Fórmulas, criterios y fuentes

Todo el cálculo vive en `src/lib/finiquito/` (función pura `calcularFiniquito`) y se ejecuta **siempre en el servidor**.
Los parámetros por ejercicio están en la tabla `ParametroLegal` (semilla en `src/lib/legal/defaults.ts`) y **se copian dentro de cada cálculo guardado**, de modo que un cálculo histórico es reproducible aunque los parámetros cambien.

> Este documento describe lo que el sistema implementa, no sustituye asesoría legal o contable. Lo que no pudo validarse está marcado **PENDIENTE** y el sistema lo trata como tal (resultado *provisional*).

## 1. Convenciones

| Tema | Regla |
|---|---|
| Dinero | `decimal.js`, nunca `float`. Importe de cada concepto, ISR y totales a 2 decimales, **mitad hacia arriba**. Salario diario derivado y factores: 6 decimales. Los totales suman importes ya redondeados. |
| Antigüedad | Se cuentan el día de ingreso y el de terminación (ingreso 15‑mar‑2024 → terminación 14‑mar‑2026 = 2 años exactos). Años + meses + días calendario. Fracción de año = días transcurridos desde el último aniversario ÷ duración (365/366) de ese año de servicio. |
| Salario diario | Semanal ÷ 7, quincenal ÷ 15, mensual ÷ 30 (art. 89 LFT). Opción «salario mínimo»: toma el de la zona (ZLFN o general) del ejercicio de terminación. |
| Salario integrado (SDI) | `SD × (365 + días aguinaldo + días vacaciones × %prima) ÷ 365 + otras percepciones diarias` (arts. 84 y 89 LFT). Vacaciones = tabla del año de servicio en curso. Puede capturarse el SDI conocido. |
| Estado del cálculo | `DEFINITIVO` (sin pendientes), `PROVISIONAL` (hay pendientes de validación/dato) o `INCOMPLETO` (hay pendientes bloqueantes). Solo parámetros **OFICIAL/CONFIRMADO** permiten `DEFINITIVO`. |

## 2. Conceptos (LFT — texto vigente de la Cámara de Diputados, reforma DOF 14‑05‑2026)

| Concepto | Fórmula | Fundamento |
|---|---|---|
| Sueldos pendientes | `SD × días` (días = terminación − último día pagado, o capturados) − pagado | Arts. 82, 83, 88; art. 33 |
| Vacaciones | Días del año de servicio en curso (tabla) × días transcurridos/duración del ciclo + días pendientes de ciclos anteriores − disfrutados − pagados; × SD | Arts. 76 y 79 |
| Prima vacacional | `días de vacaciones generados × SD × % (≥25%)` − prima pagada | Art. 80 |
| Aguinaldo | `días aguinaldo (≥15) × días laborados en el año ÷ días del año × SD` − pagado. Más días de años anteriores si se capturan. | Art. 87 |
| Prima de antigüedad | `12 días × años (con fracción proporcional) × SD`, salario topado a **2 × salario mínimo** (general de la zona o profesional) | Art. 162 (I, II, III, V), 485 y 486 |
| Indemnización 3 meses | `90 días × SDI` | Arts. 48, 50 fr. III, 52 |
| 20 días por año | Tiempo indeterminado: `20 × años × SDI`. Determinado: <1 año, salarios de la mitad del tiempo; ≥1 año, 6 meses + 20 días por año siguiente | Art. 50 fr. I y II |
| Salarios vencidos | Solo si se capturan días (por convenio o resolución): `días × SDI` | Art. 48 |

### Cuándo aplica cada cosa por motivo de terminación

| Motivo | Prestaciones proporcionales | Prima de antigüedad | Indemnizaciones |
|---|---|---|---|
| Renuncia voluntaria | Sí | Solo con ≥15 años (art. 162 fr. III) | No |
| Mutuo consentimiento | Sí | Igual que renuncia | No (cualquier pago pactado se captura en «Otros») |
| Despido justificado | Sí | Sí (aun si el despido es justificado, art. 162 fr. III) | No |
| Despido injustificado | Sí | Sí | 3 meses + 20 días/año (opcional) (+ salarios vencidos si se capturan) |
| Rescisión imputable al patrón | Sí | Sí | 3 meses + 20 días/año |
| Fin de contrato determinado | Sí | No | No |
| Fallecimiento | Sí (a beneficiarios, art. 501) | Sí, cualquier antigüedad (art. 162 fr. V) | No — **bloqueante** hasta identificar beneficiarios |
| Otra causa | Solo proporcionales | Pendiente | Pendiente — **bloqueante** (revisión jurídica) |

## 3. Impuesto sobre la renta (sin tasa fija)

Cada grupo sigue su procedimiento. Tarifa mensual del art. 96 LISR: Anexo 8 RMF (contraste directo con el PDF del SAT para **2024** y **2026**; **2025 sin capturar**).

1. **Ordinario** (sueldos, vacaciones, otros salariales): tarifa mensual escalada al periodo (`días ÷ 30.4`), art. 96 LISR.
2. **Aguinaldo y prima vacacional**: exentos hasta 30 y 15 veces la UMA por año (art. 93 fr. XIV); el excedente se retiene con el procedimiento del **art. 174 del Reglamento** (tasa efectiva = [ISR(ordinario + gravado/365×30.4) − ISR(ordinario)] ÷ (gravado/365×30.4)). El aguinaldo ya pagado consume primero la exención.
3. **Separación** (prima de antigüedad, indemnizaciones, otros por separación): exentos hasta 90 veces la UMA por año de servicio (fracción mayor a 6 meses cuenta como año; art. 93 fr. XIII; RISR art. 172). El excedente se retiene con la tasa `ISR(último sueldo mensual ordinario) ÷ ese sueldo` (art. 95 y 96); si es menor al sueldo mensual, tarifa directa.

### Criterios que requieren confirmación del administrador (estatus PENDIENTE al sembrar)

* **UMA vs. salario mínimo en el art. 93.** El texto de la LISR dice «salario mínimo general»; la práctica del SAT (desindexación, DOF 27‑01‑2016) usa la **UMA**. El sistema usa UMA y el administrador debe confirmar el criterio en *Parámetros legales* (puede cambiarse a `SALARIO_MINIMO`).
* **Subsidio para el empleo.** No se calcula; si el ingreso mensual equivalente cae bajo el límite capturado (2026: $11,492.66, fuente secundaria) el cálculo queda *provisional* con aviso.
* **Salarios vencidos:** su tratamiento fiscal no está validado → retención pendiente.
* **Periodo de retención** de sueldos+vacaciones: se usa la suma de días pagados (criterio documentado en el desglose).
* **Tarifa ISR 2025:** no capturada (no se contrastó con el Anexo 8 RMF 2025).
* **Salarios mínimos profesionales:** la resolución CONASAMI (DOF 09‑12‑2025) incluye 61 oficios; no se sembró la tabla porque no se pudo contrastar. Se capturan en la pantalla de parámetros (o directamente en el formulario por trabajador).
* **UMA/salarios mínimos** 2024‑2026: corroborados por varias fuentes secundarias (no contrastados con el DOF) → «CORROBORADO»; requieren confirmación para quedar sin pendientes.

## 4. Deducciones (art. 110 LFT)

Solo se aplican si el usuario acredita **sustento documental** y, cuando corresponde, **consentimiento por escrito**. Anticipos/pagos en exceso: tope de un mes de salario. Las deducciones por deudas del trabajador **no se descuentan de indemnizaciones** (art. 33 LFT; criterio conservador). Pensión alimenticia (mandato judicial) puede alcanzar todo el neto. «Otra» nunca se aplica automáticamente. Lo no aplicado queda visible con su motivo.

## 5. Fuentes consultadas

* LFT: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf
* LISR: https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf (copia consultada con última reforma DOF 01‑04‑2024)
* Reglamento de la LISR: https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LISR_060516.pdf
* Anexo 8 RMF 2026 (DOF 28‑12‑2025): https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo-8-RMF-2026_DOF-28122025.pdf
* Anexo 8 RMF 2024 (DOF 29‑12‑2023): https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2024/rmf/anexos/Anexo_8_RMF2024-29122023.pdf
* Salarios mínimos 2026: resolución CONASAMI, DOF 09‑12‑2025 (General $315.04; ZLFN $440.87).
* UMA 2026: INEGI, DOF 09‑01‑2026 ($117.31 desde 01‑02‑2026).

## 6. Cómo añadir un ejercicio (p. ej. 2027)

*Administración → Parámetros legales → «+ Ejercicio»*: copia el más reciente con todo en PENDIENTE. Capture salarios mínimos, UMA (con su fecha de vigencia), tarifa (Anexo 8 RMF) y confirme cada grupo tras contrastarlo. Mientras haya grupos sin confirmar, los cálculos salen *provisionales*. Si no existe el ejercicio, el motor usa el último anterior y lo advierte.
