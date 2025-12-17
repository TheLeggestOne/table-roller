<script lang="ts">
    import type { RollResult } from "src/types/rolls/roll-result";

    export let rollResult: RollResult
</script>
<div>
    This is the Roll Result Modal component.
    {JSON.stringify(rollResult)}
</div>