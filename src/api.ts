export type User = {usuario_id:string; nombre:string; email:string};
export type Event = {evento_id:string; nombre:string; categoria:string; descripcion:string; fecha:string; hora:string; lugar:string; organizador:string; imagen_url:string; cupos_disponibles:number; disponibilidad:string};
export type Registration = {inscripcion_id:string; evento_id:string; estado:string; nombre_acreditacion:string; observaciones:string; fecha_inscripcion:string; fecha_actualizacion:string; orden_espera:number|null};
let token = '';
export const setToken = (value:string) => { token = value; };
export class ApiError extends Error { constructor(message:string, public status:number, public code:string){super(message);} }
export async function api(path:string, method='GET', data?:unknown):Promise<any> {
  let response:Response;
  try { response = await fetch('/api/eventpass/'+path, {
    method, headers:{Accept:'application/json', ...(data===undefined?{}:{'Content-Type':'application/json'}), ...(token?{Authorization:`Bearer ${token}`}:{})},
    body:data===undefined?undefined:JSON.stringify(data), signal:AbortSignal.timeout(60000),
  }); } catch {throw new ApiError('No pudimos conectar. Si estabas guardando, consulta el estado antes de repetir.',0,'CONEXION');}
  let body:any;
  try {body=await response.json();} catch {throw new ApiError('El servicio devolvió una respuesta inesperada.',response.status,'FORMATO');}
  if(!response.ok || body.ok===false){
    if(response.status===401 && token){setToken('');window.dispatchEvent(new Event('session-expired'));}
    throw new ApiError(body.error?.mensaje || 'No fue posible completar la solicitud.',response.status,body.error?.codigo || 'ERROR');
  }
  return body;
}
