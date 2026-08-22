import { createElement } from 'lwc';
import DataTable from 'c/dataTable';

const MOCK_COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text', editable: true },
    { label: 'Phone', fieldName: 'Phone', type: 'phone', editable: true }
];

const MOCK_RECORDS = [
    { Id: '001000000000001AAA', Name: 'Acme Corp', Phone: '1234567890' },
    { Id: '001000000000002AAA', Name: 'Global Tech', Phone: '0987654321' }
];

describe('c-data-table', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders data-table component properly when columns and records are set', async () => {
        const element = createElement('c-data-table', {
            is: DataTable
        });
        element.columns = MOCK_COLUMNS;
        element.records = MOCK_RECORDS;
        element.objectName = 'Account';

        document.body.appendChild(element);

        await Promise.resolve();

        const searchInput = element.shadowRoot.querySelector('lightning-input');
        expect(searchInput).not.toBeNull();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(datatable).not.toBeNull();
        expect(datatable.data.length).toBe(2);
    });

    it('filters records on search input change', async () => {
        const element = createElement('c-data-table', {
            is: DataTable
        });
        element.columns = MOCK_COLUMNS;
        element.records = MOCK_RECORDS;
        element.objectName = 'Account';

        document.body.appendChild(element);

        await Promise.resolve();

        const searchInput = element.shadowRoot.querySelector('lightning-input');
        searchInput.value = 'Acme';
        searchInput.dispatchEvent(new CustomEvent('change', { target: { value: 'Acme' } }));

        await Promise.resolve();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(datatable.data.length).toBe(1);
        expect(datatable.data[0].Name).toBe('Acme Corp');
    });

    it('shows no records message when filtered dataset is empty', async () => {
        const element = createElement('c-data-table', {
            is: DataTable
        });
        element.columns = MOCK_COLUMNS;
        element.records = [];
        element.objectName = 'Account';

        document.body.appendChild(element);

        await Promise.resolve();

        const noDataMsg = element.shadowRoot.querySelector('p');
        expect(noDataMsg).not.toBeNull();
        expect(noDataMsg.textContent.trim()).toBe('No records found');
    });
});
