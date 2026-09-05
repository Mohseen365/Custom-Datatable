import { createElement } from 'lwc';
import DataWrapper from 'c/dataWrapper';
import getAllObjects from '@salesforce/apex/DynamicDataTableController.getAllObjects';
import getObjectFields from '@salesforce/apex/DynamicDataTableController.getObjectFields';
import getDynamicData from '@salesforce/apex/DynamicDataTableController.getDynamicData';

// Mock Apex wire adapters
jest.mock(
    '@salesforce/apex/DynamicDataTableController.getAllObjects',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/DynamicDataTableController.getObjectFields',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/DynamicDataTableController.getDynamicData',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

const MOCK_OBJECTS = [
    { label: 'Account', value: 'Account' },
    { label: 'Contact', value: 'Contact' }
];

const MOCK_FIELDS = [
    { label: 'Name', value: 'Name' },
    { label: 'Phone', value: 'Phone' }
];

const MOCK_DATA_RESPONSE = {
    columns: [
        { label: 'Name', fieldName: 'Name', type: 'text' },
        { label: 'Phone', fieldName: 'Phone', type: 'phone' }
    ],
    rows: [
        { Id: '001000000000001AAA', Name: 'Acme Corp', Phone: '1234567890' }
    ]
};

describe('c-data-wrapper', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders initial form inputs and wired object options', async () => {
        const element = createElement('c-data-wrapper', {
            is: DataWrapper
        });
        document.body.appendChild(element);

        getAllObjects.emit(MOCK_OBJECTS);
        getObjectFields.emit(MOCK_FIELDS);

        await Promise.resolve();

        const combobox = element.shadowRoot.querySelector('lightning-combobox');
        expect(combobox).not.toBeNull();

        const dualListbox = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dualListbox).not.toBeNull();
    });

    it('renders c-data-table child when dynamic data is loaded', async () => {
        const element = createElement('c-data-wrapper', {
            is: DataWrapper
        });
        document.body.appendChild(element);

        getAllObjects.emit(MOCK_OBJECTS);
        getObjectFields.emit(MOCK_FIELDS);

        await Promise.resolve();

        const dualListbox = element.shadowRoot.querySelector('lightning-dual-listbox');
        dualListbox.dispatchEvent(new CustomEvent('change', { detail: { value: ['Name', 'Phone'] } }));

        await Promise.resolve();

        const buttons = Array.from(element.shadowRoot.querySelectorAll('lightning-button'));
        const loadBtn = buttons.find(btn => btn.label === 'Load Data');
        expect(loadBtn).not.toBeUndefined();
        loadBtn.click();

        getDynamicData.emit(MOCK_DATA_RESPONSE);

        await Promise.resolve();

        const dataTable = element.shadowRoot.querySelector('c-data-table');
        expect(dataTable).not.toBeNull();
        expect(dataTable.records.length).toBe(1);

        const badge = element.shadowRoot.querySelector('.slds-badge');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toContain('Records Loaded: 1');
    });

    it('adds and clears filter conditions when buttons are clicked', async () => {
        const element = createElement('c-data-wrapper', {
            is: DataWrapper
        });
        document.body.appendChild(element);

        await Promise.resolve();

        const buttons = Array.from(element.shadowRoot.querySelectorAll('lightning-button'));
        const addConditionBtn = buttons.find(btn => btn.label === 'Add Condition');
        expect(addConditionBtn).not.toBeUndefined();
        addConditionBtn.click();

        await Promise.resolve();

        let filterCards = element.shadowRoot.querySelectorAll('.filter-card');
        expect(filterCards.length).toBe(2);

        const updatedButtons = Array.from(element.shadowRoot.querySelectorAll('lightning-button'));
        const clearFiltersBtn = updatedButtons.find(btn => btn.label === 'Clear Filters');
        expect(clearFiltersBtn).not.toBeUndefined();
        clearFiltersBtn.click();

        await Promise.resolve();

        filterCards = element.shadowRoot.querySelectorAll('.filter-card');
        expect(filterCards.length).toBe(1);
    });
});
