from fastapi import FastAPI
from pydantic import BaseModel
from common import event
app=FastAPI(title='3S Content Service')
RATINGS=[]
class Rating(BaseModel): value:int
@app.get('/health')
def health(): return {'status':'online'}
@app.get('/ratings')
def ratings(): return {'count':len(RATINGS),'average':round(sum(RATINGS)/len(RATINGS),2) if RATINGS else None,'minimum':1,'maximum':777}
@app.post('/ratings')
def rate(body:Rating):
    if not 1<=body.value<=777: return {'error':'out_of_range'}
    RATINGS.append(body.value); event('content','rating_submitted',value=body.value)
    return {'statistics':ratings()}
