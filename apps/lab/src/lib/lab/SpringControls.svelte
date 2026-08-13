<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { LabParameterName, LabParameters } from './model.js';
	import ParameterField from './ParameterField.svelte';

	let {
		parameters,
		onChange,
		onRun
	}: {
		parameters: LabParameters;
		onChange: (name: LabParameterName, value: number) => void;
		onRun: () => void;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col gap-3">
	<div class="grid content-start gap-3">
		<ParameterField
			id="target"
			label="Target"
			value={parameters.target}
			min={10}
			max={1000}
			step={10}
			unit="px"
			description="Equilibrium position"
			onValue={(value) => onChange('target', value)}
		/>
		<ParameterField
			id="mass"
			label="Mass"
			value={parameters.mass}
			min={0.1}
			max={10}
			step={0.1}
			unit="kg"
			description="Resistance to acceleration"
			onValue={(value) => onChange('mass', value)}
		/>
		<ParameterField
			id="stiffness"
			label="Stiffness"
			value={parameters.stiffness}
			min={10}
			max={500}
			step={5}
			unit="N/m"
			description="Restoring force per displacement"
			onValue={(value) => onChange('stiffness', value)}
		/>
		<ParameterField
			id="damping"
			label="Damping"
			value={parameters.damping}
			min={0}
			max={100}
			step={0.5}
			unit="N·s/m"
			description="Energy removed from the system"
			onValue={(value) => onChange('damping', value)}
		/>
		<ParameterField
			id="initial-velocity"
			label="Initial velocity"
			value={parameters.initialVelocity}
			min={-2000}
			max={2000}
			step={50}
			unit="px/s"
			description="Momentum at the start of motion"
			onValue={(value) => onChange('initialVelocity', value)}
		/>
		<ParameterField
			id="position-epsilon"
			label="Position tolerance"
			value={parameters.positionEpsilon}
			min={0.01}
			max={5}
			step={0.01}
			unit="px"
			description="Maximum remaining position error"
			onValue={(value) => onChange('positionEpsilon', value)}
		/>
		<ParameterField
			id="velocity-epsilon"
			label="Velocity tolerance"
			value={parameters.velocityEpsilon}
			min={0.01}
			max={5}
			step={0.01}
			unit="px/s"
			description="Maximum remaining speed"
			onValue={(value) => onChange('velocityEpsilon', value)}
		/>
	</div>

	<Button class="mt-auto w-full" onclick={onRun}>Run spring</Button>
</div>
