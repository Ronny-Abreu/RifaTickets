import imgBanreservas from '../assets/TransferPayments-Booking-Banks/Transfer-Bank-BANRESERVAS.png';
import imgBhd from '../assets/TransferPayments-Booking-Banks/Transfer-Bank-BHD.png';
import imgBpd from '../assets/TransferPayments-Booking-Banks/Transfer-Bank-BPD.png';
import imgQik from '../assets/TransferPayments-Booking-Banks/Transfer-Bank-QIK.png';
import imgQikToke from '../assets/TransferPayments-Booking-Banks/Transfer-BANK-QIK_BPD(TOKE).png';

export interface BancoInfo {
  id: string;
  nombre: string;
  img: string;
}

export const BANCOS_DISPONIBLES: BancoInfo[] = [
  { id: 'BANRESERVAS', nombre: 'Banreservas', img: imgBanreservas },
  { id: 'BHD', nombre: 'BHD', img: imgBhd },
  { id: 'BPD', nombre: 'Banco Popular', img: imgBpd },
  { id: 'QIK', nombre: 'QIK', img: imgQik },
  { id: 'QIK_BPD_TOKE', nombre: 'QIK/BPD (Toke)', img: imgQikToke },
];
