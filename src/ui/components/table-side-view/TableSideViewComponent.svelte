<script lang="ts">
  import { onMount } from "svelte";
  import TableDisplayItem from "./TableDisplayItem.svelte";
  import type { TableStore } from "src/stores/table-store";
  export let tableStore: TableStore;
  export let Header: string;

  onMount(() => {
    tableStore.reloadTables();
  });
</script>

<div>
  <h2>{Header}</h2>
  {#if $tableStore.length === 0}
    <p>No tables loaded.</p>
  {:else}
    <ul>
      {#each $tableStore as table}
        <TableDisplayItem {table} />
      {/each}
    </ul>
  {/if}
</div>