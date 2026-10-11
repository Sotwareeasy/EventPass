import {useEffect,useState,type FormEvent} from 'react';
import {api,ApiError} from './api';
type Selection={inscripcion_id:string;evento_id:string};
export default function CheckinPanel({authenticated,initial,login,onSuccess}:{authenticated:boolean;initial:Selection|null;login:()=>void;onSuccess:(id:string,date:string)=>void}){
  const [registration,setRegistration]=useState('');const [event,setEvent]=useState('');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{kind:'EXITOSO'|'DUPLICADO'|'RECHAZADO';message:string;date?:string;id?:string;warning?:string}|null>(null);
  useEffect(()=>{if(initial){setRegistration(initial.inscripcion_id);setEvent(initial.evento_id);setResult(null);}},[initial]);
  async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setResult(null);
    try{const r=await api('checkin','POST',{inscripcion_id:registration.trim(),evento_id:event.trim()});
      if(r.data?.estado!=='ASISTIO'||r.data?.resultado!=='EXITOSO')throw new Error('No se pudo confirmar el ingreso. Consulta tu inscripción antes de repetir.');
      setResult({kind:'EXITOSO',message:r.mensaje,date:r.data.fecha_checkin,id:r.data.checkin_id,warning:r.notificacion?.gmail==='ENVIADO'&&r.notificacion?.telegram==='ENVIADO'?undefined:'El ingreso quedó registrado. Alguna notificación está pendiente o no pudo entregarse.'});
      onSuccess(registration.trim(),r.data.fecha_checkin);
    }catch(error){setResult({kind:error instanceof ApiError&&error.code==='CHECKIN_DUPLICADO'?'DUPLICADO':'RECHAZADO',message:error instanceof Error?error.message:'No pudimos registrar el ingreso.'});}
    finally{setBusy(false);}
  }
  return <section className="page-section"><p className="eyebrow">BIENVENIDO AL ENCUENTRO</p><h1>Check-in digital</h1><p className="muted">Registra tu ingreso con los identificadores de tu inscripción confirmada. Puedes seleccionarla desde «Mis inscripciones».</p>
    {!authenticated?<div className="empty"><h3>Inicia sesión para registrar tu ingreso</h3><p>Solo puedes utilizar las inscripciones de tu propia cuenta.</p><button className="button" onClick={login}>Iniciar sesión</button></div>:<div className="panel checkin-panel"><form onSubmit={submit} aria-busy={busy}>
      <label>ID de inscripción<input name="inscripcion_id" value={registration} onChange={e=>setRegistration(e.target.value)} placeholder="INS-…" pattern="INS-[a-f0-9]{32}" maxLength={36} required disabled={busy}/></label>
      <label>ID del evento<input name="evento_id" value={event} onChange={e=>setEvent(e.target.value)} placeholder="EVT-…" pattern="EVT-[A-Za-z0-9_-]{1,76}" maxLength={80} required disabled={busy}/></label>
      <p>Al confirmar, tu inscripción pasará a «Asistió» y ya no podrá editarse ni cancelarse.</p>
      <button className="button" disabled={busy}>{busy?'Registrando ingreso…':'Registrar ingreso'}</button>
    </form>{result&&<div className={'notice checkin-result '+(result.kind==='RECHAZADO'?'error':'')} role={result.kind==='RECHAZADO'?'alert':'status'}><div><h3>{result.kind==='EXITOSO'?'Ingreso confirmado':result.kind==='DUPLICADO'?'Ingreso ya registrado':'Ingreso rechazado'}</h3><p>{result.message}</p>{result.date&&<p>{new Date(result.date).toLocaleString('es-CO',{timeZone:'America/Bogota'})} · Colombia</p>}{result.id&&<small>{result.id}</small>}{result.warning&&<p>{result.warning}</p>}</div></div>}</div>}
  </section>;
}
