import Swal from 'sweetalert2';

// Matches the app's dark theme (see src/styles/globals.css CSS variables)
// instead of SweetAlert2's default light popup.
const swalDark = Swal.mixin({
  background: 'hsl(222.2 84% 6.9%)',
  color: 'hsl(210 40% 98%)',
  confirmButtonColor: 'hsl(217.2 91.2% 59.8%)',
  cancelButtonColor: 'hsl(217.2 32.6% 17.5%)',
  customClass: {
    popup: 'rounded-2xl border border-white/10 shadow-2xl',
  },
  confirmButtonText: 'Entendido',
  buttonsStyling: true,
});

const swalToast = swalDark.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export type AlertIcon = 'success' | 'error' | 'warning' | 'info';

export function alertMessage(message: string, icon: AlertIcon = 'error') {
  return swalDark.fire({ icon, title: message });
}

export function toastSuccess(message: string) {
  return swalToast.fire({ icon: 'success', title: message });
}

export async function confirmAction(message: string, confirmText = 'Sí, continuar'): Promise<boolean> {
  const result = await swalDark.fire({
    icon: 'warning',
    title: message,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  });
  return result.isConfirmed;
}
