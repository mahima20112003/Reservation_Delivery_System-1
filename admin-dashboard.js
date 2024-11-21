document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Modal handling
    const modal = document.getElementById('editModal');
    const closeBtn = document.querySelector('.close-btn');
    
    closeBtn.addEventListener('click', () => modal.style.display = 'none');

    // Fetch data for display
    function fetchData() {
        fetch('/api/restaurant')
            .then(response => response.json())
            .then(data => populateTable('restaurantTable', data));

        fetch('/api/tables')
            .then(response => response.json())
            .then(data => populateTable('tablesTable', data));

        fetch('/api/menu-items')
            .then(response => response.json())
            .then(data => populateTable('menuItemsTable', data));

        fetch('/api/categories')
            .then(response => response.json())
            .then(data => populateTable('categoriesTable', data));
    }

    // Populate tables with data
    function populateTable(tableId, data) {
        const table = document.getElementById(tableId).querySelector('tbody');
        table.innerHTML = '';

        data.forEach(item => {
            const row = document.createElement('tr');
            
            Object.values(item).forEach(value => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            });

            const actionCell = document.createElement('td');
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.onclick = () => openEditModal(item);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => deleteItem(item.id, tableId);

            actionCell.appendChild(editBtn);
            actionCell.appendChild(deleteBtn);
            row.appendChild(actionCell);

            table.appendChild(row);
        });
    }

    // Open modal for editing
    function openEditModal(item) {
        modal.style.display = 'block';
        const form = document.getElementById('editForm');
        const modalFields = document.getElementById('modalFields');

        modalFields.innerHTML = '';
        
        // Generate fields dynamically based on data
        for (const [key, value] of Object.entries(item)) {
            if (key !== 'id') {
                const fieldContainer = document.createElement('div');
                const label = document.createElement('label');
                label.textContent = key.charAt(0).toUpperCase() + key.slice(1);
                const input = document.createElement('input');
                input.value = value;
                input.name = key;
                fieldContainer.appendChild(label);
                fieldContainer.appendChild(input);
                modalFields.appendChild(fieldContainer);
            }
        }

        document.getElementById('editId').value = item.id;
    }

    // Save changes
    document.getElementById('editForm').addEventListener('submit', function (event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {};
        formData.forEach((value, key) => {
            data[key] = value;
        });

        fetch('/api/update-item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(() => {
            fetchData(); // Reload data
            modal.style.display = 'none'; // Close modal
        });
    });

    // Delete item
    function deleteItem(id, tableId) {
        fetch(`/api/delete-item/${id}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(() => fetchData()); // Reload data
    }
});
