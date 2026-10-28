import {operatorDisplayName} from '../members/resolver';
import {scrub} from '../privacy';
import type {OwnerSession} from '../owner-authority';
import {computeReport} from '../reports/index';
import {widgetMetric} from './metrics';
import {eventTable,savedTableQuery} from './tables';
import type {MetricConfig} from './input';
import {canEdit,type ItemSnapshot,type ProjectSnapshot,guard} from './authority';

export async function itemView(db:D1Database,session:OwnerSession,snapshot:ItemSnapshot,projects:Map<string,ProjectSnapshot>,data=false,exporting=false){
 const {row}=snapshot,editable=canEdit(session,snapshot,projects),visible=snapshot.projects.filter(id=>projects.has(id));
 const author=row.author?await operatorDisplayName(db,row.author):null;
 const viewGuards:D1PreparedStatement[]=[];
 const widgets=await Promise.all(snapshot.widgets.filter(widget=>visible.includes(widget.project)).map(async widget=>{
  const config=JSON.parse(widget.config),common={id:widget.id,project:widget.project,name:scrub(widget.name),config,...widget.view_id?{viewId:widget.view_id}:{}};
  if(!data)return common;
  if(row.kind==='table'){
   const view=await savedTableQuery(db,widget.project,widget.view_id!);
   viewGuards.push(guard(db,'EXISTS(SELECT 1 FROM review_views WHERE project=? AND id=? AND generation=? AND query=?)',widget.project,widget.view_id,view.generation,view.serialized));
   return {...common,data:await eventTable(db,widget.project,view.query,config,exporting)};
  }
  return {...common,data:row.kind==='dashboard'?await widgetMetric(db,widget.project,config as MetricConfig):await computeReport(db,[widget.project],config)};
 }));
 return {view:{id:row.id,kind:row.kind,name:scrub(row.name),author:author?scrub(author.name):'[erased]',revision:row.revision,created:row.created,updated:row.updated,
  widgets,editable,omittedProjects:snapshot.projects.length-visible.length,shares:editable?snapshot.shares.map(share=>({id:share.id,kind:share.kind,target:scrub(share.target),active:share.active===1})):[],
  coverage:'Definitions recompute current retained evidence. Sharing never expands project read authority; inaccessible project widgets and names are withheld.'},viewGuards};
}
