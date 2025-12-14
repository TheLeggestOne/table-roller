<script lang="ts">
    import type { Table } from "src/types/tables/table";

    export let table: Table;

    function rollTable(){
        //Perform roll on this table and open result modal for the roll
        console.log("Rolling table: " + table.name);
    }

    function showAdvancedRollUI(){
        //Open Advanced Roll UI (modifiers, other customizations)
        console.log("Opening advanced roll UI for table: " + table.name);
    }

    function editTable(){
        //Open Table edit UI and load this table into it
        console.log("Editing table: " + table.name);
    }
</script>

<div>
    <div>
        <span>{table.name}</span>
    </div>
    <div>
        <button onclick={rollTable}>Roll</button> 
        <button onclick={showAdvancedRollUI}>Advanced</button>
        <button onclick={editTable}>Edit</button>
    </div>
</div>