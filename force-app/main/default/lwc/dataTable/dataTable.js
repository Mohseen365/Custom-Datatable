import { LightningElement, api, track } from 'lwc';
import { updateRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class DataTable extends LightningElement {
    @api records;
    @api columns;

    @track filteredRecords = [];
    @track visibleRecords = [];
    @track draftValues = [];
    @track editRecord = {};
    @track editFields = [];
    @track newRecord = {};
    searchTerm = '';
    currentPage = 1;
    totalPages = 0;
    noData = false;
    showModal = false;
    pageSize = 10;
    showCreateModal = false;

    @api
    refreshTable(data) {
        this.records = data;
        this.filteredRecords = [...data];
        this.currentPage = 1;
        this.setPagination();
    }

    connectedCallback() {
        if (this.records) {
            this.filteredRecords = [...this.records];
            this.setPagination();
        }
    }
    get disablePrevious() {
        return this.currentPage <= 1;
    }

    get disableNext() {
        return this.currentPage >= this.totalPages;
    }

    get pageInfo() {
        return `Page ${this.currentPage} of ${this.totalPages}`;
    }

    get computedColumns() {
        return [
            ...this.columns,
            {
                type: 'action',
                typeAttributes: {
                    rowActions: [
                        { label: 'View', name: 'view' },
                        { label: 'Edit', name: 'edit' },
                        { label: 'Delete', name: 'delete' }
                    ]
                }
            }
        ];
    }
    // Search
    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        if (this.searchTerm) {
            this.filteredRecords = this.records.filter(row =>
                Object.values(row).some(val =>
                    val && val.toString().toLowerCase().includes(this.searchTerm)
                )
            );
        } else {
            this.filteredRecords = [...this.records];
        }

        this.currentPage = 1;
        this.setPagination();
    }


    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updateVisibleRecords();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateVisibleRecords();
        }
    }

    handleRowAction(event) {
        const action = event.detail.action.name;
        const row = event.detail.row;
        
        console.log('row -> ', row);
    
        if (action === 'edit') {
            this.openEditModal(row);
        }
    
        if (action === 'delete') {
            this.handleDelete(row.Id);
        }
    }
    
    handleFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;
        console.log('field -> ', field);
        console.log('value -> ', value);
            
        this.editRecord = {
            ...this.editRecord,
            [field]: value
        };
    
        this.editFields = this.editFields.map(f => {
            if (f.fieldName === field) {
                return { ...f, value };
            }
            return f;
        });

        
        console.log('editFields -> ', this.editFields);
    } 

    handleCreateFieldChange(event) {
        const field = event.target.dataset.field;
        this.newRecord[field] = event.target.value;
    }
    

    openEditModal(row) {
        this.editRecord = { ...row };
        this.editFields = this.columns
            .filter(col => col.editable) 
            .map(col => {
                return {
                    fieldName: col.fieldName,
                    label: col.label,
                    value: row[col.fieldName] 
                };
            });
        this.showModal = true;
    }
    
    closeModal() {
        this.showModal = false;
        this.editFields = [];
        this.editRecord = {};
    }

    openNewModal() {
        this.newRecord = {};
        this.editFields = this.columns;
        this.showCreateModal = true;
    }
    
    closeCreateModal() {
        this.showCreateModal = false;
    }

    saveNewRecord() {
        this.dispatchEvent(
            new CustomEvent('createrecord', { detail: this.newRecord })
        );
        this.showCreateModal = false;
    }
    // Pagination logic
    setPagination() {
        this.totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);

        // Set noData flag if empty
        this.noData = this.filteredRecords.length === 0;

        this.updateVisibleRecords();
    }

    updateVisibleRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.visibleRecords = this.filteredRecords.slice(start, end);
    }   

    
    // INLINE SAVE HANDLER
    async handleSave(event) {
        const draftValues = event.detail.draftValues;

        try {
            const updatePromises = draftValues.map(record => {
                return updateRecord({ fields: { ...record } });
            });

            await Promise.all(updatePromises);

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Records updated successfully',
                    variant: 'success'
                })
            );

            this.draftValues = [];

            // Notify parent to refresh Apex
            this.dispatchEvent(new CustomEvent('refreshdata'));

        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Update failed',
                    variant: 'error'
                })
            );
        }
    }

    async saveModal() {
        try {
            await updateRecord({ fields: this.editRecord });
    
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Updated',
                    message: 'Record updated successfully',
                    variant: 'success'
                })
            );
    
            this.showModal = false;
            this.dispatchEvent(new CustomEvent('refreshdata'));
    
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Save failed',
                    variant: 'error'
                })
            );
        }
    }
    
}