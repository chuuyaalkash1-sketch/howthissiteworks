from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import httpx, os
from common import event
app=FastAPI(title="3S Commerce Service")
AUTH_URL=os.getenv("AUTH_URL","http://auth:8001")
class Order(BaseModel): items:list[dict]; total:float
@app.get('/health')
def health(): return {'status':'online'}
@app.post('/orders')
def order(body:Order, authorization:str|None=Header(default=None)):
    if not authorization: raise HTTPException(401,'Authentication required')
    r=httpx.get(f'{AUTH_URL}/verify',headers={'Authorization':authorization},timeout=2)
    if r.status_code!=200: raise HTTPException(401,'Authentication required')
    user=r.json()['username']; event('commerce','order_created',username=user,item_count=len(body.items),total=body.total)
    return {'status':'accepted','order_id':f'ORD-{abs(hash((user,body.total)))%1000000:06d}'}
