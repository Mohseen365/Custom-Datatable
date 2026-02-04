import { LightningElement, api } from 'lwc';

export default class DataTable extends LightningElement {
    @api records;
    @api columns;
}