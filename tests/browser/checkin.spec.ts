import {test,expect} from '@playwright/test';
const registration={inscripcion_id:'INS-'+'a'.repeat(32),evento_id:'EVT-QA',estado:'CONFIRMADA',nombre_acreditacion:'Persona QA',observaciones:'',fecha_inscripcion:'2026-01-01',orden_espera:null};
test.beforeEach(async({page})=>{
 await page.route('**/api/eventpass/eventos',r=>r.fulfill({json:{ok:true,data:{eventos:[]}}}));
 await page.route('**/api/eventpass/auth/login',r=>r.fulfill({json:{ok:true,data:{usuario:{usuario_id:'USR-QA',nombre:'Persona QA',email:'qa@example.com'},sesion:{token:'test-token'}}}}));
 await page.route('**/api/eventpass/inscripciones',r=>r.fulfill({json:{ok:true,data:{inscripciones:[registration]}}}));
 await page.goto('/');await page.getByRole('button',{name:'Iniciar sesión'}).first().click();await page.getByLabel('Correo electrónico').fill('qa@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('testing-only');await page.getByRole('dialog').getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByLabel('Mi cuenta')).toBeVisible();
 await page.getByRole('button',{name:'Mis inscripciones',exact:true}).click();await page.getByRole('button',{name:'Hacer check-in',exact:true}).click();
});
test('selección, éxito y duplicado comprensibles',async({page})=>{
 let count=0;await page.route('**/api/eventpass/checkin',async route=>{expect(route.request().postDataJSON()).toEqual({inscripcion_id:registration.inscripcion_id,evento_id:registration.evento_id});count++;await route.fulfill(count===1?{status:201,json:{ok:true,mensaje:'Check-in realizado correctamente.',data:{resultado:'EXITOSO',estado:'ASISTIO',checkin_id:'CHK-QA',fecha_checkin:'2026-10-11T17:00:00Z'},notificacion:{gmail:'ENVIADO',telegram:'ENVIADO'}}}:{status:409,json:{ok:false,error:{codigo:'CHECKIN_DUPLICADO',mensaje:'El ingreso ya había sido registrado.'}}});});
 await expect(page.getByLabel('ID de inscripción')).toHaveValue(registration.inscripcion_id);await expect(page.getByLabel('ID del evento')).toHaveValue('EVT-QA');await page.getByRole('button',{name:'Registrar ingreso',exact:true}).click();await expect(page.getByRole('heading',{name:'Ingreso confirmado'})).toBeVisible();await page.getByRole('button',{name:'Registrar ingreso',exact:true}).click();await expect(page.getByRole('heading',{name:'Ingreso ya registrado'})).toBeVisible();expect(count).toBe(2);
});
test('rechazo visible y estado de carga impide doble envío',async({page})=>{
 let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/eventpass/checkin',async route=>{await wait;await route.fulfill({status:409,json:{ok:false,error:{codigo:'CHECKIN_EVENTO_INCORRECTO',mensaje:'La inscripción no pertenece al evento indicado.'}}});});
 await page.getByLabel('ID del evento').fill('EVT-OTRO');await page.getByRole('button',{name:'Registrar ingreso',exact:true}).click();await expect(page.getByRole('button',{name:'Registrando ingreso…'})).toBeDisabled();release();await expect(page.getByRole('heading',{name:'Ingreso rechazado'})).toBeVisible();await expect(page.getByRole('alert')).toContainText('no pertenece al evento');
});
